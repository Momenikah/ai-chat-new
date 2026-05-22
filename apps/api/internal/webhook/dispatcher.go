package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Dispatcher is the small surface the rest of the codebase uses to
// publish events. Implementations are responsible for finding the
// subscribed endpoints + signing + retrying — callers never block on
// HTTP.
type Dispatcher interface {
	Emit(workspaceID string, event Event, data interface{})
}

// NoopDispatcher is the zero-value safe default — used when webhook
// delivery is intentionally disabled (e.g. tests).
type NoopDispatcher struct{}

// Emit on the noop dispatcher does nothing.
func (NoopDispatcher) Emit(string, Event, interface{}) {}

// retryDelays defines the exponential backoff schedule between attempts.
// Five attempts in total spread over ~13 minutes. After the last attempt
// the endpoint is left with an incremented failure_count for the operator
// dashboard.
var retryDelays = []time.Duration{
	2 * time.Second,
	10 * time.Second,
	30 * time.Second,
	2 * time.Minute,
	10 * time.Minute,
}

// AsyncDispatcher delivers webhooks on a bounded background worker pool.
// All persistence + HTTP work happens off the request hot path.
type AsyncDispatcher struct {
	repo    *repositories.WebhookEndpointRepository
	client  *http.Client
	queue   chan job
	workers int
}

type job struct {
	endpoint models.WebhookEndpoint
	envelope Envelope
	attempt  int
}

// NewAsyncDispatcher constructs an AsyncDispatcher with `workers`
// concurrent senders and a buffered queue. Start() must be called once
// before any Emit.
func NewAsyncDispatcher(repo *repositories.WebhookEndpointRepository, workers, queueSize int) *AsyncDispatcher {
	if workers <= 0 {
		workers = 4
	}
	if queueSize <= 0 {
		queueSize = 256
	}
	return &AsyncDispatcher{
		repo:    repo,
		client:  &http.Client{Timeout: 15 * time.Second},
		queue:   make(chan job, queueSize),
		workers: workers,
	}
}

// Start spins up worker goroutines. They exit when ctx is cancelled.
func (d *AsyncDispatcher) Start(ctx context.Context) {
	for i := 0; i < d.workers; i++ {
		go d.worker(ctx)
	}
}

// Emit fans out an event to every enabled, subscribed endpoint for the
// workspace. Lookup runs in a goroutine so the caller never blocks on DB.
func (d *AsyncDispatcher) Emit(workspaceID string, event Event, data interface{}) {
	if workspaceID == "" {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		endpoints, err := d.repo.FindByEvent(ctx, workspaceID, string(event))
		if err != nil {
			log.Printf("webhook: find endpoints (workspace=%s event=%s): %v",
				workspaceID, event, err)
			return
		}
		if len(endpoints) == 0 {
			return
		}
		env := Envelope{
			ID:          uuid.NewString(),
			Event:       event,
			WorkspaceID: workspaceID,
			OccurredAt:  time.Now().UTC(),
			Data:        data,
		}
		for _, ep := range endpoints {
			select {
			case d.queue <- job{endpoint: ep, envelope: env, attempt: 1}:
			default:
				log.Printf("webhook: queue full, dropping event %s for endpoint %s",
					event, ep.ID)
			}
		}
	}()
}

func (d *AsyncDispatcher) worker(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case j := <-d.queue:
			d.deliver(ctx, j)
		}
	}
}

func (d *AsyncDispatcher) deliver(ctx context.Context, j job) {
	body, err := json.Marshal(j.envelope)
	if err != nil {
		log.Printf("webhook: marshal envelope: %v", err)
		return
	}

	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, j.endpoint.URL, bytes.NewReader(body))
	if err != nil {
		d.logFailure(ctx, j, 0, err, time.Since(start))
		d.maybeRetry(j)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AIChat-Webhook/1.0")
	req.Header.Set(EventHeader, string(j.envelope.Event))
	req.Header.Set(DeliveryHeader, j.envelope.ID)
	req.Header.Set(SignatureHeader, Sign(j.endpoint.Secret, body))
	d.applyCustomHeaders(req, j.endpoint)

	resp, err := d.client.Do(req)
	if err != nil {
		d.logFailure(ctx, j, 0, err, time.Since(start))
		d.maybeRetry(j)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	dur := time.Since(start)
	status := resp.StatusCode
	success := status >= 200 && status < 300
	bodyStr := string(respBody)

	persistParams := repositories.CreateDeliveryLogParams{
		WorkspaceID:       j.endpoint.WorkspaceID,
		WebhookEndpointID: j.endpoint.ID,
		Event:             string(j.envelope.Event),
		Payload:           body,
		StatusCode:        &status,
		Attempt:           j.attempt,
		Succeeded:         success,
		ResponseBody:      strOrNil(bodyStr),
		DurationMs:        int(dur.Milliseconds()),
	}
	if !success {
		msg := fmt.Sprintf("HTTP %d", status)
		persistParams.ErrorMessage = &msg
	}
	_ = d.repo.CreateDeliveryLog(ctx, persistParams)
	_ = d.repo.RecordDelivery(ctx, j.endpoint.ID, time.Now(), status, success)

	if !success && j.attempt <= len(retryDelays) {
		d.maybeRetry(j)
	}
}

func (d *AsyncDispatcher) logFailure(ctx context.Context, j job, status int, err error, dur time.Duration) {
	msg := err.Error()
	var statusPtr *int
	if status != 0 {
		statusPtr = &status
	}
	_ = d.repo.CreateDeliveryLog(ctx, repositories.CreateDeliveryLogParams{
		WorkspaceID:       j.endpoint.WorkspaceID,
		WebhookEndpointID: j.endpoint.ID,
		Event:             string(j.envelope.Event),
		Payload:           mustMarshal(j.envelope),
		StatusCode:        statusPtr,
		Attempt:           j.attempt,
		Succeeded:         false,
		ErrorMessage:      &msg,
		DurationMs:        int(dur.Milliseconds()),
	})
	_ = d.repo.RecordDelivery(ctx, j.endpoint.ID, time.Now(), status, false)
}

func (d *AsyncDispatcher) maybeRetry(j job) {
	if j.attempt > len(retryDelays) {
		return
	}
	delay := retryDelays[j.attempt-1]
	go func(j job, delay time.Duration) {
		time.Sleep(delay)
		j.attempt++
		select {
		case d.queue <- j:
		default:
			log.Printf("webhook: retry queue full, dropping attempt=%d endpoint=%s",
				j.attempt, j.endpoint.ID)
		}
	}(j, delay)
}

func (d *AsyncDispatcher) applyCustomHeaders(req *http.Request, ep models.WebhookEndpoint) {
	if len(ep.Headers) == 0 {
		return
	}
	var h map[string]string
	if err := json.Unmarshal(ep.Headers, &h); err != nil {
		return
	}
	for k, v := range h {
		if k == "" || v == "" {
			continue
		}
		req.Header.Set(k, v)
	}
}

func mustMarshal(v interface{}) []byte {
	b, err := json.Marshal(v)
	if err != nil {
		return []byte("{}")
	}
	return b
}

func strOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

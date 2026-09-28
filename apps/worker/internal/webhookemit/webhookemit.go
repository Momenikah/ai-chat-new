// Package webhookemit is a minimal, self-contained outbound-webhook
// emitter for the worker process.
//
// The worker is a separate Go module from the API, so it cannot import the
// API's webhook package. This is a deliberately small reimplementation
// covering exactly what the worker needs: load enabled endpoints
// subscribed to an event, sign the payload with HMAC-SHA256, POST it, and
// record the attempt to webhook_delivery_logs. It shares the same DB
// tables as the API so the operator dashboard sees worker-originated
// deliveries too.
package webhookemit

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/worker/internal/netguard"
)

// Signature + routing headers — identical to the API side so receivers can
// treat all deliveries uniformly.
const (
	signatureHeader = "X-AIChat-Signature"
	eventHeader     = "X-AIChat-Event"
	deliveryHeader  = "X-AIChat-Delivery"
)

// Emitter delivers webhooks for the worker.
type Emitter struct {
	pool   *pgxpool.Pool
	client *http.Client
}

// New constructs an Emitter. Unless allowPrivate is set, deliveries to
// loopback / private-network addresses are refused (SSRF protection).
func New(pool *pgxpool.Pool, allowPrivate bool) *Emitter {
	return &Emitter{pool: pool, client: netguard.NewHTTPClient(15*time.Second, allowPrivate)}
}

type envelope struct {
	ID          string      `json:"id"`
	Event       string      `json:"event"`
	WorkspaceID string      `json:"workspace_id"`
	OccurredAt  time.Time   `json:"occurred_at"`
	Data        interface{} `json:"data"`
}

type endpoint struct {
	id     string
	url    string
	secret string
}

// Emit fans `event` out to every enabled endpoint subscribed to it in the
// workspace. Delivery + logging happen synchronously per endpoint but the
// whole call is fire-and-forget from the processor's perspective (it runs
// in a goroutine). Failures are logged + persisted; no retry here (the
// worker's broadcast.completed event is low-volume + non-critical).
func (e *Emitter) Emit(ctx context.Context, workspaceID, event string, data interface{}) {
	endpoints, err := e.findEndpoints(ctx, workspaceID, event)
	if err != nil {
		log.Printf("webhookemit: find endpoints: %v", err)
		return
	}
	if len(endpoints) == 0 {
		return
	}
	env := envelope{
		ID:          uuid.NewString(),
		Event:       event,
		WorkspaceID: workspaceID,
		OccurredAt:  time.Now().UTC(),
		Data:        data,
	}
	body, err := json.Marshal(env)
	if err != nil {
		return
	}
	for _, ep := range endpoints {
		e.deliver(ctx, workspaceID, event, ep, body)
	}
}

func (e *Emitter) findEndpoints(ctx context.Context, workspaceID, event string) ([]endpoint, error) {
	const q = `SELECT id::text, url, secret FROM webhook_endpoints
		WHERE workspace_id = $1 AND enabled = TRUE AND $2 = ANY(events)`
	rows, err := e.pool.Query(ctx, q, workspaceID, event)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []endpoint
	for rows.Next() {
		var ep endpoint
		if err := rows.Scan(&ep.id, &ep.url, &ep.secret); err != nil {
			return nil, err
		}
		out = append(out, ep)
	}
	return out, rows.Err()
}

func (e *Emitter) deliver(ctx context.Context, workspaceID, event string, ep endpoint, body []byte) {
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, ep.url, bytes.NewReader(body))
	if err != nil {
		e.logDelivery(ctx, workspaceID, ep.id, event, body, nil, false, "", err.Error(), 0)
		return
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "AIChat-Webhook/1.0")
	req.Header.Set(eventHeader, event)
	req.Header.Set(deliveryHeader, uuid.NewString())
	req.Header.Set(signatureHeader, sign(ep.secret, body))

	resp, err := e.client.Do(req)
	dur := int(time.Since(start).Milliseconds())
	if err != nil {
		e.logDelivery(ctx, workspaceID, ep.id, event, body, nil, false, "", err.Error(), dur)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	status := resp.StatusCode
	success := status >= 200 && status < 300
	var errMsg string
	if !success {
		errMsg = fmt.Sprintf("HTTP %d", status)
	}
	e.logDelivery(ctx, workspaceID, ep.id, event, body, &status, success, string(respBody), errMsg, dur)
	e.recordDelivery(ctx, ep.id, status, success)
}

func (e *Emitter) logDelivery(ctx context.Context, workspaceID, endpointID, event string, payload []byte, status *int, success bool, respBody, errMsg string, dur int) {
	var respPtr, errPtr *string
	if respBody != "" {
		respPtr = &respBody
	}
	if errMsg != "" {
		errPtr = &errMsg
	}
	_, err := e.pool.Exec(ctx, `
		INSERT INTO webhook_delivery_logs
			(workspace_id, webhook_endpoint_id, event, payload, status_code,
			 attempt, succeeded, response_body, error_message, duration_ms)
		VALUES ($1, $2, $3, $4, $5, 1, $6, $7, $8, $9)`,
		workspaceID, endpointID, event, payload, status, success, respPtr, errPtr, dur)
	if err != nil {
		log.Printf("webhookemit: log delivery: %v", err)
	}
}

func (e *Emitter) recordDelivery(ctx context.Context, endpointID string, status int, success bool) {
	_, _ = e.pool.Exec(ctx, `
		UPDATE webhook_endpoints
		SET last_delivery_at = now(),
		    last_status = $2,
		    failure_count = CASE WHEN $3 THEN 0 ELSE failure_count + 1 END,
		    updated_at = now()
		WHERE id = $1`, endpointID, status, success)
}

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

package broadcast

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/aichat/worker/internal/webhookemit"
)

// Processor pulls broadcast jobs off Redis, sends them via the provider,
// and persists results back to Postgres. Each Processor instance runs in
// its own goroutine; multiple instances share `Sender`, `Store`, and the
// `ChannelLimiter` so per-channel rate limits hold cluster-wide within
// the process.
type Processor struct {
	rdb         *redis.Client
	queueKey    string
	sender      *Sender
	store       *Store
	limiter     *ChannelLimiter
	maxAttempts int
	webhooks    *webhookemit.Emitter
}

// NewProcessor constructs a Processor. `webhooks` may be nil to disable
// broadcast.completed webhook emission.
func NewProcessor(rdb *redis.Client, queueKey string, sender *Sender, store *Store, limiter *ChannelLimiter, maxAttempts int, webhooks *webhookemit.Emitter) *Processor {
	if maxAttempts <= 0 {
		maxAttempts = 3
	}
	return &Processor{
		rdb: rdb, queueKey: queueKey, sender: sender,
		store: store, limiter: limiter, maxAttempts: maxAttempts,
		webhooks: webhooks,
	}
}

// Run is the main consume loop. It blocks until ctx is cancelled.
func (p *Processor) Run(ctx context.Context, workerID int) {
	for {
		if ctx.Err() != nil {
			return
		}

		res, err := p.rdb.BRPop(ctx, 5*time.Second, p.queueKey).Result()
		if err == redis.Nil {
			continue
		}
		if err != nil {
			if errors.Is(err, context.Canceled) {
				return
			}
			log.Printf("broadcast-worker[%d]: dequeue: %v", workerID, err)
			time.Sleep(time.Second)
			continue
		}
		if len(res) < 2 {
			continue
		}

		raw := []byte(res[1])
		job, err := Unmarshal(raw)
		if err != nil {
			log.Printf("broadcast-worker[%d]: malformed job: %v", workerID, err)
			continue
		}

		p.process(ctx, workerID, raw, job)
	}
}

// process handles one job end-to-end. Errors are logged but never
// returned to the run loop so we don't drop the connection.
func (p *Processor) process(ctx context.Context, workerID int, raw []byte, job Job) {
	_ = p.store.MarkQueueStarted(ctx, job.QueueRowID)

	if err := p.limiter.Wait(ctx, job.ChannelID, job.RatePerMinute); err != nil {
		return // context cancelled
	}

	sendCtx, cancel := context.WithTimeout(ctx, 25*time.Second)
	externalID, err := p.sender.Send(sendCtx, job)
	cancel()

	if err == nil {
		// Success.
		if e := p.store.MarkRecipientSent(ctx, job.RecipientID, externalID); e != nil {
			log.Printf("broadcast-worker[%d]: mark sent: %v", workerID, e)
		}
		_ = p.store.IncrementCampaignCounter(ctx, job.CampaignID, "sent")
		_ = p.store.AppendLog(ctx, job.CampaignID, job.RecipientID, "sent",
			fmt.Sprintf("provider_id=%s", externalID))
		_ = p.store.MarkQueueDone(ctx, job.QueueRowID)
		p.completeIfDone(ctx, job.CampaignID)
		return
	}

	// Failure path: count attempts on the queue row first.
	attempts, peekErr := p.peekAttempts(ctx, job.QueueRowID)
	if peekErr != nil {
		log.Printf("broadcast-worker[%d]: peek attempts: %v", workerID, peekErr)
	}

	if attempts < p.maxAttempts {
		log.Printf("broadcast-worker[%d]: retry job %s (attempt %d): %v",
			workerID, job.RecipientID, attempts, err)
		_ = p.store.BumpAttempts(ctx, job.RecipientID, err.Error())
		_ = p.store.AppendLog(ctx, job.CampaignID, job.RecipientID, "retry", err.Error())
		go p.scheduleRequeue(raw, attempts)
		return
	}

	log.Printf("broadcast-worker[%d]: job %s failed permanently after %d attempts: %v",
		workerID, job.RecipientID, attempts, err)
	_ = p.store.MarkRecipientFailed(ctx, job.RecipientID, err.Error())
	_ = p.store.IncrementCampaignCounter(ctx, job.CampaignID, "failed")
	_ = p.store.AppendLog(ctx, job.CampaignID, job.RecipientID, "failed", err.Error())
	_ = p.store.MarkQueueFailed(ctx, job.QueueRowID, err.Error())
	p.completeIfDone(ctx, job.CampaignID)
}

// completeIfDone flips the campaign to completed when the last recipient
// drains, and fires the broadcast.completed webhook exactly once.
func (p *Processor) completeIfDone(ctx context.Context, campaignID string) {
	completed, workspaceID, err := p.store.MaybeCompleteCampaign(ctx, campaignID)
	if err != nil {
		log.Printf("broadcast-worker: complete campaign: %v", err)
		return
	}
	if !completed || p.webhooks == nil {
		return
	}
	summary, err := p.store.GetCampaignSummary(ctx, campaignID)
	if err != nil {
		log.Printf("broadcast-worker: campaign summary: %v", err)
		return
	}
	go p.webhooks.Emit(context.Background(), workspaceID, "broadcast.completed", summary)
}

// scheduleRequeue re-enqueues a job after exponential backoff
// (2s / 8s / 24s). Runs in its own goroutine so the worker loop isn't
// blocked.
func (p *Processor) scheduleRequeue(raw []byte, attempts int) {
	delays := []time.Duration{2 * time.Second, 8 * time.Second, 24 * time.Second}
	d := delays[len(delays)-1]
	if attempts < len(delays) {
		d = delays[attempts]
	}
	time.Sleep(d)
	if err := p.rdb.LPush(context.Background(), p.queueKey, raw).Err(); err != nil {
		log.Printf("broadcast-worker: requeue failed: %v", err)
	}
}

// peekAttempts reads the message_queue.attempts counter. The counter is
// incremented by MarkQueueStarted when the processor picks the job up,
// so a value >= maxAttempts means we've already retried enough.
func (p *Processor) peekAttempts(ctx context.Context, queueRowID string) (int, error) {
	if queueRowID == "" {
		return 0, nil
	}
	row := p.store.pool.QueryRow(ctx, `SELECT attempts FROM message_queue WHERE id = $1`, queueRowID)
	var n int
	if err := row.Scan(&n); err != nil {
		return 0, err
	}
	return n, nil
}


package broadcast

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Store is the slim worker-side DB layer. The API owns the rich
// repository code in `apps/api`; the worker only needs a handful of
// targeted updates, so we inline them here to avoid sharing a module.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore constructs a Store.
func NewStore(pool *pgxpool.Pool) *Store { return &Store{pool: pool} }

// MarkRecipientSent records a successful delivery.
func (s *Store) MarkRecipientSent(ctx context.Context, recipientID, externalMessageID string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE broadcast_recipients
		SET status              = 'sent',
		    external_message_id = $2,
		    sent_at             = now(),
		    attempts            = attempts + 1,
		    last_error          = NULL
		WHERE id = $1`, recipientID, externalMessageID)
	return err
}

// MarkRecipientFailed records a permanent failure.
func (s *Store) MarkRecipientFailed(ctx context.Context, recipientID, errMsg string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE broadcast_recipients
		SET status     = 'failed',
		    failed_at  = now(),
		    attempts   = attempts + 1,
		    last_error = $2
		WHERE id = $1`, recipientID, errMsg)
	return err
}

// BumpAttempts increments the attempt counter on a retry.
func (s *Store) BumpAttempts(ctx context.Context, recipientID, errMsg string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE broadcast_recipients
		SET attempts   = attempts + 1,
		    last_error = $2
		WHERE id = $1`, recipientID, errMsg)
	return err
}

// IncrementCampaignCounter mirrors the API's IncrementCounter — bumps a
// single named counter on the campaign.
func (s *Store) IncrementCampaignCounter(ctx context.Context, campaignID, event string) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE broadcast_campaigns
		SET sent_count      = sent_count      + CASE WHEN $2 = 'sent'      THEN 1 ELSE 0 END,
		    delivered_count = delivered_count + CASE WHEN $2 = 'delivered' THEN 1 ELSE 0 END,
		    read_count      = read_count      + CASE WHEN $2 = 'read'      THEN 1 ELSE 0 END,
		    failed_count    = failed_count    + CASE WHEN $2 = 'failed'    THEN 1 ELSE 0 END,
		    updated_at      = now()
		WHERE id = $1`, campaignID, event)
	return err
}

// AppendLog inserts one broadcast-log row.
func (s *Store) AppendLog(ctx context.Context, campaignID, recipientID, event, detail string) error {
	var rec any
	if recipientID != "" {
		rec = recipientID
	}
	var det any
	if detail != "" {
		det = detail
	}
	_, err := s.pool.Exec(ctx, `
		INSERT INTO broadcast_logs (campaign_id, recipient_id, event, detail)
		VALUES ($1, $2, $3, $4)`,
		campaignID, rec, event, det)
	return err
}

// MaybeCompleteCampaign flips the campaign to `completed` when no
// `queued` recipient rows remain. It returns (completed, workspaceID):
// `completed` is true only on the actual sending→completed transition (so
// the caller can fire the broadcast.completed webhook exactly once).
func (s *Store) MaybeCompleteCampaign(ctx context.Context, campaignID string) (bool, string, error) {
	const q = `
		WITH leftover AS (
			SELECT count(*) AS n FROM broadcast_recipients
			WHERE campaign_id = $1 AND status = 'queued'
		)
		UPDATE broadcast_campaigns
		SET status       = 'completed',
		    completed_at = now(),
		    updated_at   = now()
		WHERE id = $1
		  AND status   = 'sending'
		  AND (SELECT n FROM leftover) = 0
		RETURNING workspace_id::text`
	var workspaceID string
	if err := s.pool.QueryRow(ctx, q, campaignID).Scan(&workspaceID); err != nil {
		if err == pgx.ErrNoRows {
			return false, "", nil // not the completing transition
		}
		return false, "", err
	}
	return true, workspaceID, nil
}

// GetCampaignSummary loads the small set of campaign fields included in the
// broadcast.completed webhook payload.
func (s *Store) GetCampaignSummary(ctx context.Context, campaignID string) (map[string]any, error) {
	const q = `SELECT id::text, workspace_id::text, name, status::text,
		total_recipients, sent_count, delivered_count, failed_count
		FROM broadcast_campaigns WHERE id = $1`
	var id, workspaceID, name, status string
	var total, sent, delivered, failed int
	if err := s.pool.QueryRow(ctx, q, campaignID).Scan(
		&id, &workspaceID, &name, &status, &total, &sent, &delivered, &failed,
	); err != nil {
		return nil, err
	}
	return map[string]any{
		"id":               id,
		"workspace_id":     workspaceID,
		"name":             name,
		"status":           status,
		"total_recipients": total,
		"sent_count":       sent,
		"delivered_count":  delivered,
		"failed_count":     failed,
	}, nil
}

// MarkQueueStarted flips a message_queue row to "processing" and bumps
// the attempt counter.
func (s *Store) MarkQueueStarted(ctx context.Context, queueRowID string) error {
	if queueRowID == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE message_queue
		SET status = 'processing', started_at = now(), attempts = attempts + 1
		WHERE id = $1`, queueRowID)
	return err
}

// MarkQueueDone marks a message_queue row as done.
func (s *Store) MarkQueueDone(ctx context.Context, queueRowID string) error {
	if queueRowID == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE message_queue
		SET status = 'done', completed_at = now(), error = NULL
		WHERE id = $1`, queueRowID)
	return err
}

// MarkQueueFailed marks a message_queue row as failed.
func (s *Store) MarkQueueFailed(ctx context.Context, queueRowID, errMsg string) error {
	if queueRowID == "" {
		return nil
	}
	_, err := s.pool.Exec(ctx, `
		UPDATE message_queue
		SET status = 'failed', completed_at = now(), error = $2
		WHERE id = $1`, queueRowID, errMsg)
	return err
}

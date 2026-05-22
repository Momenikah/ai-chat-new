package repositories

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// BroadcastRepository handles persistence for campaigns + recipients +
// audit logs + the outbox queue.
type BroadcastRepository struct {
	db DBTX
}

// NewBroadcastRepository constructs a BroadcastRepository.
func NewBroadcastRepository(db DBTX) *BroadcastRepository {
	return &BroadcastRepository{db: db}
}

// WithTx returns a repository bound to a transaction.
func (r *BroadcastRepository) WithTx(tx pgx.Tx) *BroadcastRepository {
	return &BroadcastRepository{db: tx}
}

const campaignColumns = `
	id::text, workspace_id::text, channel_id::text, template_id::text,
	name, audience_kind, audience_filter, body_override, variables,
	status::text, rate_per_minute, scheduled_at, started_at, completed_at,
	total_recipients, sent_count, delivered_count, read_count, failed_count,
	reply_count, created_by::text, created_at, updated_at`

const recipientColumns = `
	id::text, campaign_id::text, workspace_id::text, contact_id::text,
	name, phone, external_id, variables, rendered_body, status::text,
	message_id::text, external_message_id, attempts, last_error,
	enqueued_at, sent_at, delivered_at, read_at, failed_at, created_at`

// CreateCampaignParams holds the inputs for inserting a campaign.
type CreateCampaignParams struct {
	WorkspaceID    string
	ChannelID      string
	TemplateID     *string
	Name           string
	AudienceKind   string
	AudienceFilter json.RawMessage
	BodyOverride   *string
	Variables      json.RawMessage
	RatePerMinute  int
	CreatedBy      *string
}

// CreateCampaign inserts a new campaign row.
func (r *BroadcastRepository) CreateCampaign(ctx context.Context, p CreateCampaignParams) (*models.BroadcastCampaign, error) {
	if len(p.AudienceFilter) == 0 {
		p.AudienceFilter = json.RawMessage(`{}`)
	}
	if len(p.Variables) == 0 {
		p.Variables = json.RawMessage(`{}`)
	}
	if p.RatePerMinute <= 0 {
		p.RatePerMinute = 60
	}
	const q = `
		INSERT INTO broadcast_campaigns
			(workspace_id, channel_id, template_id, name, audience_kind, audience_filter,
			 body_override, variables, rate_per_minute, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING ` + campaignColumns
	return scanCampaign(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.ChannelID, p.TemplateID, p.Name, p.AudienceKind,
		p.AudienceFilter, p.BodyOverride, p.Variables, p.RatePerMinute, p.CreatedBy,
	))
}

// GetCampaignByID fetches a campaign.
func (r *BroadcastRepository) GetCampaignByID(ctx context.Context, id string) (*models.BroadcastCampaign, error) {
	const q = `SELECT ` + campaignColumns + ` FROM broadcast_campaigns WHERE id = $1`
	return scanCampaign(r.db.QueryRow(ctx, q, id))
}

// ListCampaignsByWorkspace returns campaigns of a workspace.
func (r *BroadcastRepository) ListCampaignsByWorkspace(ctx context.Context, workspaceID string) ([]models.BroadcastCampaign, error) {
	const q = `SELECT ` + campaignColumns + ` FROM broadcast_campaigns
		WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BroadcastCampaign{}
	for rows.Next() {
		c, err := scanCampaignRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *c)
	}
	return out, rows.Err()
}

// UpdateCampaignStatusParams holds status-transition fields.
type UpdateCampaignStatusParams struct {
	ID           string
	Status       models.BroadcastStatus
	ScheduledAt  *time.Time
	StartedAt    *time.Time
	CompletedAt  *time.Time
}

// UpdateCampaignStatus flips the lifecycle status.
func (r *BroadcastRepository) UpdateCampaignStatus(ctx context.Context, p UpdateCampaignStatusParams) (*models.BroadcastCampaign, error) {
	const q = `UPDATE broadcast_campaigns
		SET status        = $2,
		    scheduled_at  = COALESCE($3, scheduled_at),
		    started_at    = COALESCE($4, started_at),
		    completed_at  = COALESCE($5, completed_at),
		    updated_at    = now()
		WHERE id = $1
		RETURNING ` + campaignColumns
	return scanCampaign(r.db.QueryRow(ctx, q,
		p.ID, string(p.Status), p.ScheduledAt, p.StartedAt, p.CompletedAt,
	))
}

// SetTotalRecipients records the audience size.
func (r *BroadcastRepository) SetTotalRecipients(ctx context.Context, id string, total int) error {
	_, err := r.db.Exec(ctx,
		`UPDATE broadcast_campaigns SET total_recipients = $2, updated_at = now() WHERE id = $1`,
		id, total)
	return err
}

// IncrementCounter bumps the per-status counter on a campaign.
func (r *BroadcastRepository) IncrementCounter(ctx context.Context, id, event string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE broadcast_campaigns
		SET sent_count      = sent_count      + CASE WHEN $2 = 'sent'      THEN 1 ELSE 0 END,
		    delivered_count = delivered_count + CASE WHEN $2 = 'delivered' THEN 1 ELSE 0 END,
		    read_count      = read_count      + CASE WHEN $2 = 'read'      THEN 1 ELSE 0 END,
		    failed_count    = failed_count    + CASE WHEN $2 = 'failed'    THEN 1 ELSE 0 END,
		    reply_count     = reply_count     + CASE WHEN $2 = 'reply'     THEN 1 ELSE 0 END,
		    updated_at      = now()
		WHERE id = $1`, id, event)
	return err
}

// --- recipients -------------------------------------------------------------

// CreateRecipientParams holds inputs for inserting a recipient row.
type CreateRecipientParams struct {
	CampaignID    string
	WorkspaceID   string
	ContactID     *string
	Name          *string
	Phone         *string
	ExternalID    *string
	Variables     json.RawMessage
	RenderedBody  string
}

// CreateRecipient inserts a recipient row in `queued` state.
func (r *BroadcastRepository) CreateRecipient(ctx context.Context, p CreateRecipientParams) (*models.BroadcastRecipient, error) {
	if len(p.Variables) == 0 {
		p.Variables = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO broadcast_recipients
			(campaign_id, workspace_id, contact_id, name, phone, external_id,
			 variables, rendered_body, status, enqueued_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'queued', now())
		RETURNING ` + recipientColumns
	return scanRecipient(r.db.QueryRow(ctx, q,
		p.CampaignID, p.WorkspaceID, p.ContactID, p.Name, p.Phone, p.ExternalID,
		p.Variables, p.RenderedBody,
	))
}

// ListRecipientsByCampaign returns the first 1000 recipients of a campaign.
func (r *BroadcastRepository) ListRecipientsByCampaign(ctx context.Context, campaignID string) ([]models.BroadcastRecipient, error) {
	const q = `SELECT ` + recipientColumns + ` FROM broadcast_recipients
		WHERE campaign_id = $1 ORDER BY created_at ASC LIMIT 1000`
	rows, err := r.db.Query(ctx, q, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BroadcastRecipient{}
	for rows.Next() {
		rec, err := scanRecipientRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *rec)
	}
	return out, rows.Err()
}

// UpdateRecipientStatusParams captures a recipient delivery transition.
type UpdateRecipientStatusParams struct {
	ID                string
	Status            models.RecipientStatus
	ExternalMessageID *string
	LastError         *string
	BumpAttempts      bool
}

// UpdateRecipientStatus persists a delivery transition + (optionally)
// bumps the attempt counter.
func (r *BroadcastRepository) UpdateRecipientStatus(ctx context.Context, p UpdateRecipientStatusParams) error {
	const q = `UPDATE broadcast_recipients
		SET status              = $2,
		    external_message_id = COALESCE($3, external_message_id),
		    last_error          = $4,
		    sent_at             = CASE WHEN $2 = 'sent'      THEN now() ELSE sent_at END,
		    delivered_at        = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END,
		    read_at             = CASE WHEN $2 = 'read'      THEN now() ELSE read_at END,
		    failed_at           = CASE WHEN $2 = 'failed'    THEN now() ELSE failed_at END,
		    attempts            = attempts + CASE WHEN $5 THEN 1 ELSE 0 END
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q,
		p.ID, string(p.Status), p.ExternalMessageID, p.LastError, p.BumpAttempts,
	)
	return err
}

// AppendLog inserts a single broadcast-log row.
func (r *BroadcastRepository) AppendLog(ctx context.Context, campaignID string, recipientID *string, event string, detail *string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO broadcast_logs (campaign_id, recipient_id, event, detail)
		 VALUES ($1, $2, $3, $4)`,
		campaignID, recipientID, event, detail)
	return err
}

// ListLogs returns the last 200 log rows of a campaign.
func (r *BroadcastRepository) ListLogs(ctx context.Context, campaignID string) ([]models.BroadcastLog, error) {
	const q = `SELECT id::text, campaign_id::text, recipient_id::text, event, detail, occurred_at
		FROM broadcast_logs
		WHERE campaign_id = $1
		ORDER BY occurred_at DESC
		LIMIT 200`
	rows, err := r.db.Query(ctx, q, campaignID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BroadcastLog{}
	for rows.Next() {
		var l models.BroadcastLog
		if err := rows.Scan(
			&l.ID, &l.CampaignID, &l.RecipientID, &l.Event, &l.Detail, &l.OccurredAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// --- message_queue outbox ---------------------------------------------------

// CreateQueueRow inserts an outbox row.
func (r *BroadcastRepository) CreateQueueRow(ctx context.Context, workspaceID, kind string, payload json.RawMessage, scheduledAt *time.Time) (string, error) {
	const q = `INSERT INTO message_queue (workspace_id, kind, payload, scheduled_at)
		VALUES ($1, $2, $3, $4)
		RETURNING id::text`
	var id string
	if err := r.db.QueryRow(ctx, q, workspaceID, kind, payload, scheduledAt).Scan(&id); err != nil {
		return "", err
	}
	return id, nil
}

// MarkQueueStarted bumps attempts + flips status to processing.
func (r *BroadcastRepository) MarkQueueStarted(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE message_queue
		SET status = 'processing', started_at = now(), attempts = attempts + 1
		WHERE id = $1`, id)
	return err
}

// MarkQueueDone marks a queue row as completed.
func (r *BroadcastRepository) MarkQueueDone(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `UPDATE message_queue
		SET status = 'done', completed_at = now(), error = NULL
		WHERE id = $1`, id)
	return err
}

// MarkQueueFailed marks a queue row as failed with an error message.
func (r *BroadcastRepository) MarkQueueFailed(ctx context.Context, id string, errMsg string) error {
	_, err := r.db.Exec(ctx, `UPDATE message_queue
		SET status = 'failed', completed_at = now(), error = $2
		WHERE id = $1`, id, errMsg)
	return err
}

// --- scan helpers -----------------------------------------------------------

func scanCampaign(row pgx.Row) (*models.BroadcastCampaign, error) {
	c, err := scanCampaignRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

func scanCampaignRow(row pgx.Row) (*models.BroadcastCampaign, error) {
	var c models.BroadcastCampaign
	var status string
	if err := row.Scan(
		&c.ID, &c.WorkspaceID, &c.ChannelID, &c.TemplateID,
		&c.Name, &c.AudienceKind, &c.AudienceFilter, &c.BodyOverride, &c.Variables,
		&status, &c.RatePerMinute, &c.ScheduledAt, &c.StartedAt, &c.CompletedAt,
		&c.TotalRecipients, &c.SentCount, &c.DeliveredCount, &c.ReadCount,
		&c.FailedCount, &c.ReplyCount, &c.CreatedBy, &c.CreatedAt, &c.UpdatedAt,
	); err != nil {
		return nil, err
	}
	c.Status = models.BroadcastStatus(status)
	return &c, nil
}

func scanRecipient(row pgx.Row) (*models.BroadcastRecipient, error) {
	rec, err := scanRecipientRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return rec, nil
}

func scanRecipientRow(row pgx.Row) (*models.BroadcastRecipient, error) {
	var r models.BroadcastRecipient
	var status string
	if err := row.Scan(
		&r.ID, &r.CampaignID, &r.WorkspaceID, &r.ContactID,
		&r.Name, &r.Phone, &r.ExternalID, &r.Variables, &r.RenderedBody,
		&status, &r.MessageID, &r.ExternalMessageID, &r.Attempts, &r.LastError,
		&r.EnqueuedAt, &r.SentAt, &r.DeliveredAt, &r.ReadAt, &r.FailedAt, &r.CreatedAt,
	); err != nil {
		return nil, err
	}
	r.Status = models.RecipientStatus(status)
	return &r, nil
}

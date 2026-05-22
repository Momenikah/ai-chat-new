package repositories

import (
	"context"
	"encoding/json"

	"github.com/aichat/api/internal/models"
)

// WebhookLogRepository persists inbound/outbound webhook audit rows.
type WebhookLogRepository struct {
	db DBTX
}

// NewWebhookLogRepository constructs a WebhookLogRepository.
func NewWebhookLogRepository(db DBTX) *WebhookLogRepository {
	return &WebhookLogRepository{db: db}
}

// CreateWebhookLogParams holds inputs for inserting a log row.
type CreateWebhookLogParams struct {
	WorkspaceID  *string
	ChannelID    *string
	Provider     string
	Direction    string // "incoming" / "outgoing"
	EventType    *string
	StatusCode   int
	Payload      json.RawMessage
	ErrorMessage *string
}

// Create inserts a webhook-log row.
func (r *WebhookLogRepository) Create(ctx context.Context, p CreateWebhookLogParams) (*models.WebhookLog, error) {
	if len(p.Payload) == 0 {
		p.Payload = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO webhook_logs
			(workspace_id, channel_id, provider, direction, event_type, status_code, payload, error_message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id::text, workspace_id::text, channel_id::text, provider, direction,
		          event_type, status_code, payload, error_message, received_at`
	var l models.WebhookLog
	if err := r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.ChannelID, p.Provider, p.Direction, p.EventType,
		p.StatusCode, p.Payload, p.ErrorMessage,
	).Scan(
		&l.ID, &l.WorkspaceID, &l.ChannelID, &l.Provider, &l.Direction,
		&l.EventType, &l.StatusCode, &l.Payload, &l.ErrorMessage, &l.ReceivedAt,
	); err != nil {
		return nil, err
	}
	return &l, nil
}

// ListByChannel returns recent log rows for a channel.
func (r *WebhookLogRepository) ListByChannel(ctx context.Context, channelID string, limit int) ([]models.WebhookLog, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	const q = `
		SELECT id::text, workspace_id::text, channel_id::text, provider, direction,
		       event_type, status_code, payload, error_message, received_at
		FROM webhook_logs
		WHERE channel_id = $1
		ORDER BY received_at DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, channelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.WebhookLog{}
	for rows.Next() {
		var l models.WebhookLog
		if err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.ChannelID, &l.Provider, &l.Direction,
			&l.EventType, &l.StatusCode, &l.Payload, &l.ErrorMessage, &l.ReceivedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

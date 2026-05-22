package repositories

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// ActivityRepository handles persistence for contact-timeline activities.
type ActivityRepository struct {
	db DBTX
}

// NewActivityRepository constructs an ActivityRepository.
func NewActivityRepository(db DBTX) *ActivityRepository {
	return &ActivityRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *ActivityRepository) WithTx(tx pgx.Tx) *ActivityRepository {
	return &ActivityRepository{db: tx}
}

// CreateActivityParams holds inputs for inserting a timeline activity.
type CreateActivityParams struct {
	ContactID   string
	WorkspaceID string
	ActorID     *string
	Kind        string
	Body        *string
	Metadata    json.RawMessage
}

// Create inserts a new activity row.
func (r *ActivityRepository) Create(ctx context.Context, p CreateActivityParams) (*models.ContactActivity, error) {
	meta := p.Metadata
	if len(meta) == 0 {
		meta = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO contact_activities (contact_id, workspace_id, actor_id, kind, body, metadata)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text, contact_id::text, workspace_id::text, actor_id::text,
		          kind, body, metadata, occurred_at, created_at`
	var a models.ContactActivity
	if err := r.db.QueryRow(ctx, q,
		p.ContactID, p.WorkspaceID, p.ActorID, p.Kind, p.Body, meta).Scan(
		&a.ID, &a.ContactID, &a.WorkspaceID, &a.ActorID,
		&a.Kind, &a.Body, &a.Metadata, &a.OccurredAt, &a.CreatedAt,
	); err != nil {
		return nil, err
	}
	return &a, nil
}

// ListByContact returns the timeline rows for a contact.
func (r *ActivityRepository) ListByContact(ctx context.Context, contactID string) ([]models.ContactActivity, error) {
	const q = `
		SELECT a.id::text, a.contact_id::text, a.workspace_id::text, a.actor_id::text,
		       u.name, a.kind, a.body, a.metadata, a.occurred_at, a.created_at
		FROM contact_activities a
		LEFT JOIN users u ON u.id = a.actor_id
		WHERE a.contact_id = $1
		ORDER BY a.occurred_at DESC
		LIMIT 200`
	rows, err := r.db.Query(ctx, q, contactID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.ContactActivity{}
	for rows.Next() {
		var a models.ContactActivity
		if err := rows.Scan(
			&a.ID, &a.ContactID, &a.WorkspaceID, &a.ActorID, &a.ActorName,
			&a.Kind, &a.Body, &a.Metadata, &a.OccurredAt, &a.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// ListMessagesForContact returns the last N messages across all conversations
// of a contact, enriched with conversation channel. Used by the timeline.
type ContactMessage struct {
	models.Message
	ChannelType models.ChannelType `json:"channel_type"`
}

// ListMessagesForContact returns timeline messages.
func (r *ActivityRepository) ListMessagesForContact(ctx context.Context, contactID string, limit int) ([]ContactMessage, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `
		SELECT m.id::text, m.conversation_id::text, m.workspace_id::text,
		       m.direction::text, m.kind::text, m.body, m.status::text,
		       m.sender_user_id::text, m.external_id, m.created_at,
		       ch.type::text
		FROM messages m
		JOIN conversations c ON c.id = m.conversation_id
		JOIN channels ch ON ch.id = c.channel_id
		WHERE c.contact_id = $1
		ORDER BY m.created_at DESC
		LIMIT $2`
	rows, err := r.db.Query(ctx, q, contactID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []ContactMessage{}
	for rows.Next() {
		var cm ContactMessage
		var direction, kind, status, chType string
		if err := rows.Scan(
			&cm.ID, &cm.ConversationID, &cm.WorkspaceID,
			&direction, &kind, &cm.Body, &status,
			&cm.SenderUserID, &cm.ExternalID, &cm.CreatedAt,
			&chType,
		); err != nil {
			return nil, err
		}
		cm.Direction = models.MessageDirection(direction)
		cm.Kind = models.MessageKind(kind)
		cm.Status = models.MessageStatus(status)
		cm.ChannelType = models.ChannelType(chType)
		out = append(out, cm)
	}
	return out, rows.Err()
}

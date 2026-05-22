package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// MessageRepository handles persistence for messages.
type MessageRepository struct {
	db DBTX
}

// NewMessageRepository constructs a MessageRepository.
func NewMessageRepository(db DBTX) *MessageRepository {
	return &MessageRepository{db: db}
}

const messageColumns = `
	id::text, conversation_id::text, workspace_id::text, direction::text,
	kind::text, body, status::text, sender_user_id::text, external_id, created_at`

// CreateMessageParams holds inputs for inserting a message.
type CreateMessageParams struct {
	ConversationID string
	WorkspaceID    string
	Direction      models.MessageDirection
	Kind           models.MessageKind
	Body           *string
	Status         models.MessageStatus
	SenderUserID   *string
}

// Create inserts a new message.
func (r *MessageRepository) Create(ctx context.Context, p CreateMessageParams) (*models.Message, error) {
	const q = `
		INSERT INTO messages (conversation_id, workspace_id, direction, kind, body, status, sender_user_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING ` + messageColumns
	return scanMessage(r.db.QueryRow(ctx, q,
		p.ConversationID, p.WorkspaceID, string(p.Direction), string(p.Kind),
		p.Body, string(p.Status), p.SenderUserID))
}

// GetByID returns a message by its primary key.
func (r *MessageRepository) GetByID(ctx context.Context, id string) (*models.Message, error) {
	const q = `SELECT ` + messageColumns + ` FROM messages WHERE id = $1`
	return scanMessage(r.db.QueryRow(ctx, q, id))
}

// GetByExternalID returns a message by its provider id (e.g. wamid…).
func (r *MessageRepository) GetByExternalID(ctx context.Context, externalID string) (*models.Message, error) {
	const q = `SELECT ` + messageColumns + ` FROM messages WHERE external_id = $1 LIMIT 1`
	return scanMessage(r.db.QueryRow(ctx, q, externalID))
}

// SetExternalID stores the provider id on an outbound message after the
// provider acknowledged it.
func (r *MessageRepository) SetExternalID(ctx context.Context, id, externalID string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE messages SET external_id = $2 WHERE id = $1`, id, externalID)
	return err
}

// UpdateStatus sets the delivery status on a message.
func (r *MessageRepository) UpdateStatus(ctx context.Context, id string, status models.MessageStatus) error {
	_, err := r.db.Exec(ctx,
		`UPDATE messages SET status = $2 WHERE id = $1`, id, string(status))
	return err
}

// UpdateStatusByExternalID updates by provider id; returns whether a row
// was found.
func (r *MessageRepository) UpdateStatusByExternalID(ctx context.Context, externalID string, status models.MessageStatus) (bool, error) {
	tag, err := r.db.Exec(ctx,
		`UPDATE messages SET status = $2 WHERE external_id = $1`, externalID, string(status))
	if err != nil {
		return false, err
	}
	return tag.RowsAffected() > 0, nil
}

// CreateAttachmentParams holds inputs for inserting a message_attachment row.
type CreateAttachmentParams struct {
	MessageID    string
	URL          string
	MimeType     *string
	SizeBytes    int64
	ThumbnailURL *string
}

// CreateAttachment persists an attachment for a message.
func (r *MessageRepository) CreateAttachment(ctx context.Context, p CreateAttachmentParams) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO message_attachments (message_id, url, mime_type, size_bytes, thumbnail_url)
		VALUES ($1, $2, $3, $4, $5)`,
		p.MessageID, p.URL, p.MimeType, p.SizeBytes, p.ThumbnailURL)
	return err
}

// ListByConversation returns messages of a conversation, oldest first.
func (r *MessageRepository) ListByConversation(ctx context.Context, conversationID string) ([]models.Message, error) {
	const q = `SELECT ` + messageColumns + ` FROM messages WHERE conversation_id = $1 ORDER BY created_at ASC LIMIT 500`
	rows, err := r.db.Query(ctx, q, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.Message{}
	for rows.Next() {
		m, err := scanMessageRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *m)
	}
	return out, rows.Err()
}

// CountByWorkspaceSince counts messages created on/after `since` in a
// workspace. Used by the usage dashboard (message-history window).
func (r *MessageRepository) CountByWorkspaceSince(ctx context.Context, workspaceID string, since time.Time) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM messages WHERE workspace_id = $1 AND created_at >= $2`,
		workspaceID, since).Scan(&n)
	return n, err
}

func scanMessage(row pgx.Row) (*models.Message, error) {
	m, err := scanMessageRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return m, nil
}

func scanMessageRow(row pgx.Row) (*models.Message, error) {
	var m models.Message
	var direction, kind, status string
	if err := row.Scan(
		&m.ID, &m.ConversationID, &m.WorkspaceID, &direction,
		&kind, &m.Body, &status, &m.SenderUserID, &m.ExternalID, &m.CreatedAt,
	); err != nil {
		return nil, err
	}
	m.Direction = models.MessageDirection(direction)
	m.Kind = models.MessageKind(kind)
	m.Status = models.MessageStatus(status)
	return &m, nil
}

package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// ConversationRepository handles persistence for conversations and the
// assignment audit log.
type ConversationRepository struct {
	db DBTX
}

// NewConversationRepository constructs a ConversationRepository.
func NewConversationRepository(db DBTX) *ConversationRepository {
	return &ConversationRepository{db: db}
}

const conversationColumns = `
	id::text, workspace_id::text, channel_id::text, contact_id::text,
	status::text, assigned_agent_id::text, last_message_at, last_message_preview,
	unread_count, created_at, updated_at`

const conversationColumnsC = `
	c.id::text, c.workspace_id::text, c.channel_id::text, c.contact_id::text,
	c.status::text, c.assigned_agent_id::text, c.last_message_at, c.last_message_preview,
	c.unread_count, c.created_at, c.updated_at`

// CreateConversationParams holds inputs for inserting a conversation.
type CreateConversationParams struct {
	WorkspaceID string
	ChannelID   string
	ContactID   string
	Status      models.ConversationStatus
}

// Create inserts a new conversation.
func (r *ConversationRepository) Create(ctx context.Context, p CreateConversationParams) (*models.Conversation, error) {
	const q = `
		INSERT INTO conversations (workspace_id, channel_id, contact_id, status)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + conversationColumns
	return scanConversation(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.ChannelID, p.ContactID, string(p.Status)))
}

// GetByID fetches a conversation by id.
func (r *ConversationRepository) GetByID(ctx context.Context, id string) (*models.Conversation, error) {
	const q = `SELECT ` + conversationColumns + ` FROM conversations WHERE id = $1`
	return scanConversation(r.db.QueryRow(ctx, q, id))
}

// FindOpenByContactChannel returns the most recent non-resolved conversation
// for the given (channel, contact) pair, if any.
func (r *ConversationRepository) FindOpenByContactChannel(ctx context.Context, channelID, contactID string) (*models.Conversation, error) {
	const q = `SELECT ` + conversationColumns + `
		FROM conversations
		WHERE channel_id = $1 AND contact_id = $2 AND status <> 'resolved'
		ORDER BY last_message_at DESC NULLS LAST
		LIMIT 1`
	return scanConversation(r.db.QueryRow(ctx, q, channelID, contactID))
}

// ListByWorkspace returns enriched conversations for the inbox list.
func (r *ConversationRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.ConversationListItem, error) {
	const q = `
		SELECT ` + conversationColumnsC + `,
			co.name, co.avatar_url, ch.type::text, ch.name
		FROM conversations c
		JOIN contacts co ON co.id = c.contact_id
		JOIN channels ch ON ch.id = c.channel_id
		WHERE c.workspace_id = $1
		ORDER BY c.last_message_at DESC NULLS LAST
		LIMIT 200`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.ConversationListItem{}
	for rows.Next() {
		var item models.ConversationListItem
		var status, channelType string
		if err := rows.Scan(
			&item.ID, &item.WorkspaceID, &item.ChannelID, &item.ContactID,
			&status, &item.AssignedAgentID, &item.LastMessageAt, &item.LastMessagePreview,
			&item.UnreadCount, &item.CreatedAt, &item.UpdatedAt,
			&item.ContactName, &item.ContactAvatarURL, &channelType, &item.ChannelName,
		); err != nil {
			return nil, err
		}
		item.Status = models.ConversationStatus(status)
		item.ChannelType = models.ChannelType(channelType)
		out = append(out, item)
	}
	return out, rows.Err()
}

// UpdateStatus saves a new status for a conversation.
func (r *ConversationRepository) UpdateStatus(ctx context.Context, id string, status models.ConversationStatus) (*models.Conversation, error) {
	const q = `UPDATE conversations SET status = $2, updated_at = now() WHERE id = $1 RETURNING ` + conversationColumns
	return scanConversation(r.db.QueryRow(ctx, q, id, string(status)))
}

// Assign sets the assigned agent for a conversation. A nil pointer
// unassigns the conversation.
func (r *ConversationRepository) Assign(ctx context.Context, id string, agentID *string) (*models.Conversation, error) {
	const q = `UPDATE conversations SET assigned_agent_id = $2, updated_at = now() WHERE id = $1 RETURNING ` + conversationColumns
	return scanConversation(r.db.QueryRow(ctx, q, id, agentID))
}

// TouchLastMessage updates the last-message snapshot of a conversation.
func (r *ConversationRepository) TouchLastMessage(ctx context.Context, id, preview string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE conversations
		SET last_message_at = now(),
		    last_message_preview = $2,
		    updated_at = now()
		WHERE id = $1`, id, preview)
	return err
}

// IncrementUnread bumps the unread counter (used on inbound messages).
func (r *ConversationRepository) IncrementUnread(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE conversations SET unread_count = unread_count + 1, updated_at = now() WHERE id = $1`, id)
	return err
}

// ResetUnread zeroes the unread counter (used when the thread is opened).
func (r *ConversationRepository) ResetUnread(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE conversations SET unread_count = 0, updated_at = now() WHERE id = $1`, id)
	return err
}

// IsAIDisabled reports whether AI auto-reply has been turned off for a
// conversation (e.g. after a human agent took over).
func (r *ConversationRepository) IsAIDisabled(ctx context.Context, conversationID string) (bool, error) {
	var disabled bool
	err := r.db.QueryRow(ctx,
		`SELECT ai_disabled FROM conversations WHERE id = $1`, conversationID,
	).Scan(&disabled)
	return disabled, err
}

// SetAIDisabled toggles the per-conversation AI flag.
func (r *ConversationRepository) SetAIDisabled(ctx context.Context, conversationID string, disabled bool) error {
	_, err := r.db.Exec(ctx,
		`UPDATE conversations SET ai_disabled = $2, updated_at = now() WHERE id = $1`,
		conversationID, disabled)
	return err
}

// RecordAssignment appends an assignment audit-log row.
func (r *ConversationRepository) RecordAssignment(ctx context.Context, conversationID string, assignedTo, assignedBy *string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO conversation_assignments (conversation_id, assigned_to, assigned_by) VALUES ($1, $2, $3)`,
		conversationID, assignedTo, assignedBy)
	return err
}

func scanConversation(row pgx.Row) (*models.Conversation, error) {
	var c models.Conversation
	var status string
	err := row.Scan(
		&c.ID, &c.WorkspaceID, &c.ChannelID, &c.ContactID,
		&status, &c.AssignedAgentID, &c.LastMessageAt, &c.LastMessagePreview,
		&c.UnreadCount, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	c.Status = models.ConversationStatus(status)
	return &c, nil
}

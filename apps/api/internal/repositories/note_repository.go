package repositories

import (
	"context"

	"github.com/aichat/api/internal/models"
)

// NoteRepository handles persistence for internal notes.
type NoteRepository struct {
	db DBTX
}

// NewNoteRepository constructs a NoteRepository.
func NewNoteRepository(db DBTX) *NoteRepository {
	return &NoteRepository{db: db}
}

// Create inserts a new internal note.
func (r *NoteRepository) Create(ctx context.Context, conversationID, authorID, body string) (*models.InternalNote, error) {
	const q = `
		WITH inserted AS (
			INSERT INTO internal_notes (conversation_id, author_id, body)
			VALUES ($1, $2, $3)
			RETURNING id, conversation_id, author_id, body, created_at, updated_at
		)
		SELECT i.id::text, i.conversation_id::text, i.author_id::text,
		       i.body, i.created_at, i.updated_at,
		       u.name, u.email
		FROM inserted i
		LEFT JOIN users u ON u.id = i.author_id`
	var n models.InternalNote
	if err := r.db.QueryRow(ctx, q, conversationID, authorID, body).Scan(
		&n.ID, &n.ConversationID, &n.AuthorID, &n.Body,
		&n.CreatedAt, &n.UpdatedAt, &n.AuthorName, &n.AuthorEmail,
	); err != nil {
		return nil, err
	}
	return &n, nil
}

// ListByConversation returns notes of a conversation, newest first.
func (r *NoteRepository) ListByConversation(ctx context.Context, conversationID string) ([]models.InternalNote, error) {
	const q = `
		SELECT n.id::text, n.conversation_id::text, n.author_id::text,
		       n.body, n.created_at, n.updated_at,
		       u.name, u.email
		FROM internal_notes n
		LEFT JOIN users u ON u.id = n.author_id
		WHERE n.conversation_id = $1
		ORDER BY n.created_at DESC`
	rows, err := r.db.Query(ctx, q, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.InternalNote{}
	for rows.Next() {
		var n models.InternalNote
		if err := rows.Scan(
			&n.ID, &n.ConversationID, &n.AuthorID, &n.Body,
			&n.CreatedAt, &n.UpdatedAt, &n.AuthorName, &n.AuthorEmail,
		); err != nil {
			return nil, err
		}
		out = append(out, n)
	}
	return out, rows.Err()
}

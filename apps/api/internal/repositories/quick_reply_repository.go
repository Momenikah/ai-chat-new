package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// QuickReplyRepository handles persistence for canned quick-reply snippets.
type QuickReplyRepository struct {
	db DBTX
}

// NewQuickReplyRepository constructs a QuickReplyRepository.
func NewQuickReplyRepository(db DBTX) *QuickReplyRepository {
	return &QuickReplyRepository{db: db}
}

const quickReplyColumns = `
	id::text, workspace_id::text, shortcut, body,
	created_by::text, created_at, updated_at`

// CreateQuickReplyParams holds inputs for inserting a quick reply.
type CreateQuickReplyParams struct {
	WorkspaceID string
	Shortcut    string
	Body        string
	CreatedBy   *string
}

// Create inserts a quick reply.
func (r *QuickReplyRepository) Create(ctx context.Context, p CreateQuickReplyParams) (*models.QuickReply, error) {
	const q = `
		INSERT INTO quick_replies (workspace_id, shortcut, body, created_by)
		VALUES ($1, $2, $3, $4)
		RETURNING ` + quickReplyColumns
	return scanQuickReply(r.db.QueryRow(ctx, q, p.WorkspaceID, p.Shortcut, p.Body, p.CreatedBy))
}

// GetByID fetches a quick reply by id.
func (r *QuickReplyRepository) GetByID(ctx context.Context, id string) (*models.QuickReply, error) {
	const q = `SELECT ` + quickReplyColumns + ` FROM quick_replies WHERE id = $1`
	return scanQuickReply(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all quick replies in a workspace.
func (r *QuickReplyRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.QuickReply, error) {
	const q = `SELECT ` + quickReplyColumns + ` FROM quick_replies
		WHERE workspace_id = $1 ORDER BY shortcut ASC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.QuickReply{}
	for rows.Next() {
		var qr models.QuickReply
		if err := rows.Scan(
			&qr.ID, &qr.WorkspaceID, &qr.Shortcut, &qr.Body,
			&qr.CreatedBy, &qr.CreatedAt, &qr.UpdatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, qr)
	}
	return out, rows.Err()
}

// Update saves the editable fields of a quick reply.
func (r *QuickReplyRepository) Update(ctx context.Context, id, shortcut, body string) (*models.QuickReply, error) {
	const q = `UPDATE quick_replies
		SET shortcut = $2, body = $3, updated_at = now()
		WHERE id = $1
		RETURNING ` + quickReplyColumns
	return scanQuickReply(r.db.QueryRow(ctx, q, id, shortcut, body))
}

// Delete removes a quick reply.
func (r *QuickReplyRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM quick_replies WHERE id = $1`, id)
	return err
}

func scanQuickReply(row pgx.Row) (*models.QuickReply, error) {
	var q models.QuickReply
	err := row.Scan(
		&q.ID, &q.WorkspaceID, &q.Shortcut, &q.Body,
		&q.CreatedBy, &q.CreatedAt, &q.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &q, nil
}

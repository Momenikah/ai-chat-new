package repositories

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// InteractiveRepository handles persistence for reusable interactive
// message payloads (reply-buttons / list / carousel).
type InteractiveRepository struct {
	db DBTX
}

// NewInteractiveRepository constructs an InteractiveRepository.
func NewInteractiveRepository(db DBTX) *InteractiveRepository {
	return &InteractiveRepository{db: db}
}

const interactiveColumns = `
	id::text, workspace_id::text, name, kind, payload,
	created_by::text, created_at, updated_at`

// CreateInteractiveParams holds inputs for inserting an interactive payload.
type CreateInteractiveParams struct {
	WorkspaceID string
	Name        string
	Kind        string
	Payload     json.RawMessage
	CreatedBy   *string
}

// Create inserts a new interactive message.
func (r *InteractiveRepository) Create(ctx context.Context, p CreateInteractiveParams) (*models.InteractiveMessage, error) {
	if len(p.Payload) == 0 {
		p.Payload = json.RawMessage(`{}`)
	}
	const q = `
		INSERT INTO interactive_messages (workspace_id, name, kind, payload, created_by)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + interactiveColumns
	return scanInteractive(r.db.QueryRow(ctx, q, p.WorkspaceID, p.Name, p.Kind, p.Payload, p.CreatedBy))
}

// GetByID fetches an interactive message by id.
func (r *InteractiveRepository) GetByID(ctx context.Context, id string) (*models.InteractiveMessage, error) {
	const q = `SELECT ` + interactiveColumns + ` FROM interactive_messages WHERE id = $1`
	return scanInteractive(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all interactive messages of a workspace.
func (r *InteractiveRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.InteractiveMessage, error) {
	const q = `SELECT ` + interactiveColumns + ` FROM interactive_messages
		WHERE workspace_id = $1 ORDER BY updated_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.InteractiveMessage{}
	for rows.Next() {
		im, err := scanInteractiveRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *im)
	}
	return out, rows.Err()
}

// Update saves the editable fields of an interactive payload.
func (r *InteractiveRepository) Update(ctx context.Context, id, name string, payload json.RawMessage) (*models.InteractiveMessage, error) {
	if len(payload) == 0 {
		payload = json.RawMessage(`{}`)
	}
	const q = `UPDATE interactive_messages
		SET name = $2, payload = $3, updated_at = now()
		WHERE id = $1
		RETURNING ` + interactiveColumns
	return scanInteractive(r.db.QueryRow(ctx, q, id, name, payload))
}

// Delete removes an interactive message.
func (r *InteractiveRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM interactive_messages WHERE id = $1`, id)
	return err
}

func scanInteractive(row pgx.Row) (*models.InteractiveMessage, error) {
	im, err := scanInteractiveRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return im, nil
}

func scanInteractiveRow(row pgx.Row) (*models.InteractiveMessage, error) {
	var m models.InteractiveMessage
	if err := row.Scan(
		&m.ID, &m.WorkspaceID, &m.Name, &m.Kind, &m.Payload,
		&m.CreatedBy, &m.CreatedAt, &m.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &m, nil
}

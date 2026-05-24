package repositories

import (
	"context"

	"github.com/aichat/api/internal/models"
)

// TagRepository handles persistence for tags and contact-tag attachments.
type TagRepository struct {
	db DBTX
}

// NewTagRepository constructs a TagRepository.
func NewTagRepository(db DBTX) *TagRepository {
	return &TagRepository{db: db}
}

// Create inserts a new tag.
func (r *TagRepository) Create(ctx context.Context, workspaceID, name, color string) (*models.Tag, error) {
	const q = `
		INSERT INTO tags (workspace_id, name, color)
		VALUES ($1, $2, $3)
		RETURNING id::text, workspace_id::text, name, color, created_at`
	var t models.Tag
	if err := r.db.QueryRow(ctx, q, workspaceID, name, color).
		Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

// ListByWorkspace returns the tag library of a workspace.
func (r *TagRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.Tag, error) {
	const q = `SELECT id::text, workspace_id::text, name, color, created_at
		FROM tags WHERE workspace_id = $1 ORDER BY name ASC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Tag{}
	for rows.Next() {
		var t models.Tag
		if err := rows.Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

// AttachToContact links a tag to a contact (idempotent).
func (r *TagRepository) AttachToContact(ctx context.Context, contactID, tagID string) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO contact_tags (contact_id, tag_id) VALUES ($1, $2)
		 ON CONFLICT (contact_id, tag_id) DO NOTHING`, contactID, tagID)
	return err
}

// Delete removes a tag (cascades to contact_tags).
func (r *TagRepository) Delete(ctx context.Context, id, workspaceID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM tags WHERE id = $1 AND workspace_id = $2`, id, workspaceID)
	return err
}

// GetByID fetches a tag by id.
func (r *TagRepository) GetByID(ctx context.Context, id string) (*models.Tag, error) {
	const q = `SELECT id::text, workspace_id::text, name, color, created_at
		FROM tags WHERE id = $1`
	var t models.Tag
	if err := r.db.QueryRow(ctx, q, id).
		Scan(&t.ID, &t.WorkspaceID, &t.Name, &t.Color, &t.CreatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

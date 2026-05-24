package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// WorkspaceRepository handles persistence for workspaces (tenants).
type WorkspaceRepository struct {
	db DBTX
}

// NewWorkspaceRepository constructs a WorkspaceRepository.
func NewWorkspaceRepository(db DBTX) *WorkspaceRepository {
	return &WorkspaceRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *WorkspaceRepository) WithTx(tx pgx.Tx) *WorkspaceRepository {
	return &WorkspaceRepository{db: tx}
}

const workspaceColumns = `
	id::text, name, slug, logo_url, brand_color, timezone,
	owner_id::text, suspended_at, suspension_reason, created_at, updated_at`

// workspaceColumnsW is the same list qualified with the `w` alias, for use
// in JOIN queries where bare column names would be ambiguous.
const workspaceColumnsW = `
	w.id::text, w.name, w.slug, w.logo_url, w.brand_color, w.timezone,
	w.owner_id::text, w.suspended_at, w.suspension_reason, w.created_at, w.updated_at`

// CreateWorkspaceParams holds inputs for inserting a workspace.
type CreateWorkspaceParams struct {
	Name       string
	Slug       string
	OwnerID    string
	BrandColor string
	Timezone   string
}

// Create inserts a new workspace.
func (r *WorkspaceRepository) Create(ctx context.Context, p CreateWorkspaceParams) (*models.Workspace, error) {
	const q = `
		INSERT INTO workspaces (name, slug, owner_id, brand_color, timezone)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING ` + workspaceColumns
	return scanWorkspace(r.db.QueryRow(ctx, q, p.Name, p.Slug, p.OwnerID, p.BrandColor, p.Timezone))
}

// GetByID fetches a workspace by id.
func (r *WorkspaceRepository) GetByID(ctx context.Context, id string) (*models.Workspace, error) {
	const q = `SELECT ` + workspaceColumns + ` FROM workspaces WHERE id = $1`
	return scanWorkspace(r.db.QueryRow(ctx, q, id))
}

// GetBySlug fetches a workspace by slug.
func (r *WorkspaceRepository) GetBySlug(ctx context.Context, slug string) (*models.Workspace, error) {
	const q = `SELECT ` + workspaceColumns + ` FROM workspaces WHERE slug = $1`
	return scanWorkspace(r.db.QueryRow(ctx, q, slug))
}

// SlugExists reports whether a slug is already taken.
func (r *WorkspaceRepository) SlugExists(ctx context.Context, slug string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM workspaces WHERE slug = $1)`, slug).Scan(&exists)
	return exists, err
}

// ListForUser returns the workspaces the user is an active member of,
// each annotated with the user's role.
func (r *WorkspaceRepository) ListForUser(ctx context.Context, userID string) ([]models.WorkspaceWithRole, error) {
	const q = `
		SELECT ` + workspaceColumnsW + `, m.role::text
		FROM workspaces w
		JOIN workspace_members m ON m.workspace_id = w.id
		WHERE m.user_id = $1 AND m.status = 'active'
		ORDER BY w.created_at ASC`
	rows, err := r.db.Query(ctx, q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.WorkspaceWithRole{}
	for rows.Next() {
		var w models.Workspace
		var role string
		if err := rows.Scan(
			&w.ID, &w.Name, &w.Slug, &w.LogoURL, &w.BrandColor, &w.Timezone,
			&w.OwnerID, &w.SuspendedAt, &w.SuspensionReason, &w.CreatedAt, &w.UpdatedAt, &role,
		); err != nil {
			return nil, err
		}
		out = append(out, models.WorkspaceWithRole{
			Workspace:  w,
			MemberRole: models.MemberRole(role),
		})
	}
	return out, rows.Err()
}

// UpdateWorkspaceParams holds the mutable workspace fields.
type UpdateWorkspaceParams struct {
	ID         string
	Name       string
	LogoURL    *string
	BrandColor string
	Timezone   string
}

// Update saves the editable workspace fields.
func (r *WorkspaceRepository) Update(ctx context.Context, p UpdateWorkspaceParams) (*models.Workspace, error) {
	const q = `
		UPDATE workspaces
		SET name = $2, logo_url = $3, brand_color = $4, timezone = $5, updated_at = now()
		WHERE id = $1
		RETURNING ` + workspaceColumns
	return scanWorkspace(r.db.QueryRow(ctx, q, p.ID, p.Name, p.LogoURL, p.BrandColor, p.Timezone))
}

// Delete removes a workspace (cascades to members, channels, etc).
func (r *WorkspaceRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM workspaces WHERE id = $1`, id)
	return err
}

func scanWorkspace(row pgx.Row) (*models.Workspace, error) {
	var w models.Workspace
	err := row.Scan(
		&w.ID, &w.Name, &w.Slug, &w.LogoURL, &w.BrandColor, &w.Timezone,
		&w.OwnerID, &w.SuspendedAt, &w.SuspensionReason, &w.CreatedAt, &w.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &w, nil
}

// SetSuspended suspends or un-suspends a workspace. A non-nil reason is
// stored only when suspending.
func (r *WorkspaceRepository) SetSuspended(ctx context.Context, id string, suspended bool, reason *string) error {
	if suspended {
		_, err := r.db.Exec(ctx,
			`UPDATE workspaces SET suspended_at = now(), suspension_reason = $2, updated_at = now() WHERE id = $1`,
			id, reason)
		return err
	}
	_, err := r.db.Exec(ctx,
		`UPDATE workspaces SET suspended_at = NULL, suspension_reason = NULL, updated_at = now() WHERE id = $1`,
		id)
	return err
}

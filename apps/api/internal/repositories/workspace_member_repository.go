package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// WorkspaceMemberRepository handles persistence for workspace memberships.
type WorkspaceMemberRepository struct {
	db DBTX
}

// NewWorkspaceMemberRepository constructs a WorkspaceMemberRepository.
func NewWorkspaceMemberRepository(db DBTX) *WorkspaceMemberRepository {
	return &WorkspaceMemberRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *WorkspaceMemberRepository) WithTx(tx pgx.Tx) *WorkspaceMemberRepository {
	return &WorkspaceMemberRepository{db: tx}
}

const memberColumns = `
	id::text, workspace_id::text, user_id::text, role::text, status::text,
	invited_by::text, joined_at, created_at, updated_at`

// memberColumnsM is the same list qualified with the `m` alias, for use in
// JOIN queries where bare column names would be ambiguous.
const memberColumnsM = `
	m.id::text, m.workspace_id::text, m.user_id::text, m.role::text, m.status::text,
	m.invited_by::text, m.joined_at, m.created_at, m.updated_at`

// AddMemberParams holds inputs for inserting a membership.
type AddMemberParams struct {
	WorkspaceID string
	UserID      string
	Role        models.MemberRole
	Status      models.MemberStatus
	InvitedBy   *string
	JoinedAt    *time.Time
}

// Add inserts a new workspace membership.
func (r *WorkspaceMemberRepository) Add(ctx context.Context, p AddMemberParams) (*models.WorkspaceMember, error) {
	const q = `
		INSERT INTO workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + memberColumns
	return scanMember(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.UserID, string(p.Role), string(p.Status), p.InvitedBy, p.JoinedAt))
}

// Get returns the membership of a user in a workspace, if any.
func (r *WorkspaceMemberRepository) Get(ctx context.Context, workspaceID, userID string) (*models.WorkspaceMember, error) {
	const q = `SELECT ` + memberColumns + `
		FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`
	return scanMember(r.db.QueryRow(ctx, q, workspaceID, userID))
}

// GetByID returns a membership by its id.
func (r *WorkspaceMemberRepository) GetByID(ctx context.Context, id string) (*models.WorkspaceMember, error) {
	const q = `SELECT ` + memberColumns + ` FROM workspace_members WHERE id = $1`
	return scanMember(r.db.QueryRow(ctx, q, id))
}

// List returns all members of a workspace enriched with user profiles.
func (r *WorkspaceMemberRepository) List(ctx context.Context, workspaceID string) ([]models.MemberWithUser, error) {
	const q = `
		SELECT ` + memberColumnsM + `,
			u.name, u.email, u.avatar_url
		FROM workspace_members m
		JOIN users u ON u.id = m.user_id
		WHERE m.workspace_id = $1
		ORDER BY m.created_at ASC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.MemberWithUser{}
	for rows.Next() {
		var m models.MemberWithUser
		var role, status string
		if err := rows.Scan(
			&m.ID, &m.WorkspaceID, &m.UserID, &role, &status,
			&m.InvitedBy, &m.JoinedAt, &m.CreatedAt, &m.UpdatedAt,
			&m.UserName, &m.UserEmail, &m.UserAvatarURL,
		); err != nil {
			return nil, err
		}
		m.Role = models.MemberRole(role)
		m.Status = models.MemberStatus(status)
		out = append(out, m)
	}
	return out, rows.Err()
}

// Count returns the number of members in a workspace.
func (r *WorkspaceMemberRepository) Count(ctx context.Context, workspaceID string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM workspace_members WHERE workspace_id = $1`, workspaceID).Scan(&n)
	return n, err
}

// UpdateRole changes a member's role.
func (r *WorkspaceMemberRepository) UpdateRole(ctx context.Context, workspaceID, userID string, role models.MemberRole) (*models.WorkspaceMember, error) {
	const q = `
		UPDATE workspace_members SET role = $3, updated_at = now()
		WHERE workspace_id = $1 AND user_id = $2
		RETURNING ` + memberColumns
	return scanMember(r.db.QueryRow(ctx, q, workspaceID, userID, string(role)))
}

// Delete removes a membership by id, scoped to a workspace.
func (r *WorkspaceMemberRepository) Delete(ctx context.Context, id, workspaceID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM workspace_members WHERE id = $1 AND workspace_id = $2`, id, workspaceID)
	return err
}

func scanMember(row pgx.Row) (*models.WorkspaceMember, error) {
	var m models.WorkspaceMember
	var role, status string
	err := row.Scan(
		&m.ID, &m.WorkspaceID, &m.UserID, &role, &status,
		&m.InvitedBy, &m.JoinedAt, &m.CreatedAt, &m.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	m.Role = models.MemberRole(role)
	m.Status = models.MemberStatus(status)
	return &m, nil
}

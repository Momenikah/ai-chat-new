package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// InvitationRepository handles persistence for workspace invitations.
type InvitationRepository struct {
	db DBTX
}

// NewInvitationRepository constructs an InvitationRepository.
func NewInvitationRepository(db DBTX) *InvitationRepository {
	return &InvitationRepository{db: db}
}

// WithTx returns a repository bound to the given transaction.
func (r *InvitationRepository) WithTx(tx pgx.Tx) *InvitationRepository {
	return &InvitationRepository{db: tx}
}

const invitationColumns = `
	id::text, workspace_id::text, email, role::text, token, status::text,
	invited_by::text, expires_at, accepted_at, created_at, updated_at`

// CreateInvitationParams holds inputs for inserting an invitation.
type CreateInvitationParams struct {
	WorkspaceID string
	Email       string
	Role        models.MemberRole
	Token       string
	InvitedBy   string
	ExpiresAt   time.Time
}

// Create inserts a new pending invitation.
func (r *InvitationRepository) Create(ctx context.Context, p CreateInvitationParams) (*models.WorkspaceInvitation, error) {
	const q = `
		INSERT INTO workspace_invitations (workspace_id, email, role, token, invited_by, expires_at)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + invitationColumns
	return scanInvitation(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Email, string(p.Role), p.Token, p.InvitedBy, p.ExpiresAt))
}

// GetByToken fetches an invitation by its token.
func (r *InvitationRepository) GetByToken(ctx context.Context, token string) (*models.WorkspaceInvitation, error) {
	const q = `SELECT ` + invitationColumns + ` FROM workspace_invitations WHERE token = $1`
	return scanInvitation(r.db.QueryRow(ctx, q, token))
}

// GetPending fetches a pending invitation for an email in a workspace.
func (r *InvitationRepository) GetPending(ctx context.Context, workspaceID, email string) (*models.WorkspaceInvitation, error) {
	const q = `SELECT ` + invitationColumns + `
		FROM workspace_invitations
		WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'pending'`
	return scanInvitation(r.db.QueryRow(ctx, q, workspaceID, email))
}

// ListPending returns all pending invitations of a workspace.
func (r *InvitationRepository) ListPending(ctx context.Context, workspaceID string) ([]models.WorkspaceInvitation, error) {
	const q = `SELECT ` + invitationColumns + `
		FROM workspace_invitations
		WHERE workspace_id = $1 AND status = 'pending'
		ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []models.WorkspaceInvitation{}
	for rows.Next() {
		inv, err := scanInvitationRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *inv)
	}
	return out, rows.Err()
}

// MarkAccepted flips an invitation to the accepted state.
func (r *InvitationRepository) MarkAccepted(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE workspace_invitations
		SET status = 'accepted', accepted_at = now(), updated_at = now()
		WHERE id = $1`, id)
	return err
}

// Revoke flips an invitation to the revoked state.
func (r *InvitationRepository) Revoke(ctx context.Context, id, workspaceID string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE workspace_invitations
		SET status = 'revoked', updated_at = now()
		WHERE id = $1 AND workspace_id = $2`, id, workspaceID)
	return err
}

func scanInvitation(row pgx.Row) (*models.WorkspaceInvitation, error) {
	inv, err := scanInvitationRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return inv, nil
}

func scanInvitationRow(row pgx.Row) (*models.WorkspaceInvitation, error) {
	var inv models.WorkspaceInvitation
	var role, status string
	if err := row.Scan(
		&inv.ID, &inv.WorkspaceID, &inv.Email, &role, &inv.Token, &status,
		&inv.InvitedBy, &inv.ExpiresAt, &inv.AcceptedAt, &inv.CreatedAt, &inv.UpdatedAt,
	); err != nil {
		return nil, err
	}
	inv.Role = models.MemberRole(role)
	inv.Status = models.InvitationStatus(status)
	return &inv, nil
}

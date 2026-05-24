package repositories

import (
	"context"

	"github.com/aichat/api/internal/models"
)

// PresenceRepository handles persistence for agent presence (online/away).
type PresenceRepository struct {
	db DBTX
}

// NewPresenceRepository constructs a PresenceRepository.
func NewPresenceRepository(db DBTX) *PresenceRepository {
	return &PresenceRepository{db: db}
}

// Upsert sets or updates a user's presence in a workspace.
func (r *PresenceRepository) Upsert(ctx context.Context, userID, workspaceID, status string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO agent_presence (user_id, workspace_id, status, last_seen_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		ON CONFLICT (user_id, workspace_id) DO UPDATE
		SET status       = EXCLUDED.status,
		    last_seen_at = now(),
		    updated_at   = now()`, userID, workspaceID, status)
	return err
}

// ListByWorkspace returns presence rows for a workspace enriched with user info.
func (r *PresenceRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.AgentPresence, error) {
	const q = `
		SELECT p.user_id::text, p.workspace_id::text, p.status, p.last_seen_at, p.updated_at,
		       u.name, u.email
		FROM agent_presence p
		JOIN users u ON u.id = p.user_id
		WHERE p.workspace_id = $1`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AgentPresence{}
	for rows.Next() {
		var p models.AgentPresence
		if err := rows.Scan(
			&p.UserID, &p.WorkspaceID, &p.Status, &p.LastSeenAt, &p.UpdatedAt,
			&p.UserName, &p.UserEmail,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

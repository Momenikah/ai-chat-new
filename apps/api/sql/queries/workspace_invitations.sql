-- name: CreateInvitation :one
INSERT INTO workspace_invitations (workspace_id, email, role, token, invited_by, expires_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetInvitationByToken :one
SELECT * FROM workspace_invitations
WHERE token = $1;

-- name: GetPendingInvitation :one
SELECT * FROM workspace_invitations
WHERE workspace_id = $1 AND lower(email) = lower($2) AND status = 'pending';

-- name: ListWorkspaceInvitations :many
SELECT * FROM workspace_invitations
WHERE workspace_id = $1 AND status = 'pending'
ORDER BY created_at DESC;

-- name: MarkInvitationAccepted :exec
UPDATE workspace_invitations
SET status = 'accepted', accepted_at = now(), updated_at = now()
WHERE id = $1;

-- name: RevokeInvitation :exec
UPDATE workspace_invitations
SET status = 'revoked', updated_at = now()
WHERE id = $1 AND workspace_id = $2;

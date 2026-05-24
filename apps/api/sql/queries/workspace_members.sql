-- name: AddWorkspaceMember :one
INSERT INTO workspace_members (workspace_id, user_id, role, status, invited_by, joined_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetWorkspaceMember :one
SELECT * FROM workspace_members
WHERE workspace_id = $1 AND user_id = $2;

-- name: GetWorkspaceMemberByID :one
SELECT * FROM workspace_members
WHERE id = $1;

-- name: ListWorkspaceMembers :many
SELECT m.*, u.name AS user_name, u.email AS user_email, u.avatar_url AS user_avatar_url
FROM workspace_members m
JOIN users u ON u.id = m.user_id
WHERE m.workspace_id = $1
ORDER BY m.created_at ASC;

-- name: CountWorkspaceMembers :one
SELECT count(*) AS total FROM workspace_members
WHERE workspace_id = $1;

-- name: UpdateWorkspaceMemberRole :one
UPDATE workspace_members
SET role = $3, updated_at = now()
WHERE workspace_id = $1 AND user_id = $2
RETURNING *;

-- name: DeleteWorkspaceMember :exec
DELETE FROM workspace_members
WHERE id = $1 AND workspace_id = $2;

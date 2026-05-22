-- name: CreateWorkspace :one
INSERT INTO workspaces (name, slug, owner_id, brand_color, timezone)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetWorkspaceByID :one
SELECT * FROM workspaces
WHERE id = $1;

-- name: GetWorkspaceBySlug :one
SELECT * FROM workspaces
WHERE slug = $1;

-- name: WorkspaceSlugExists :one
SELECT EXISTS (
    SELECT 1 FROM workspaces WHERE slug = $1
) AS exists;

-- name: ListWorkspacesForUser :many
SELECT w.*, m.role AS member_role
FROM workspaces w
JOIN workspace_members m ON m.workspace_id = w.id
WHERE m.user_id = $1 AND m.status = 'active'
ORDER BY w.created_at ASC;

-- name: UpdateWorkspace :one
UPDATE workspaces
SET name        = $2,
    logo_url    = $3,
    brand_color = $4,
    timezone    = $5,
    updated_at  = now()
WHERE id = $1
RETURNING *;

-- name: DeleteWorkspace :exec
DELETE FROM workspaces
WHERE id = $1;

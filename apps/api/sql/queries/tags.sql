-- name: CreateTag :one
INSERT INTO tags (workspace_id, name, color)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListTagsByWorkspace :many
SELECT * FROM tags WHERE workspace_id = $1 ORDER BY name ASC;

-- name: AttachTagToContact :exec
INSERT INTO contact_tags (contact_id, tag_id)
VALUES ($1, $2)
ON CONFLICT (contact_id, tag_id) DO NOTHING;

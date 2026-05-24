-- name: CreateInteractiveMessage :one
INSERT INTO interactive_messages (workspace_id, name, kind, payload, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetInteractiveMessageByID :one
SELECT * FROM interactive_messages WHERE id = $1;

-- name: ListInteractiveMessagesByWorkspace :many
SELECT * FROM interactive_messages
WHERE workspace_id = $1
ORDER BY updated_at DESC;

-- name: UpdateInteractiveMessage :one
UPDATE interactive_messages
SET name = $2, payload = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteInteractiveMessage :exec
DELETE FROM interactive_messages WHERE id = $1;

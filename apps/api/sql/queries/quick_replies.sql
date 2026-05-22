-- name: CreateQuickReply :one
INSERT INTO quick_replies (workspace_id, shortcut, body, created_by)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetQuickReplyByID :one
SELECT * FROM quick_replies WHERE id = $1;

-- name: ListQuickRepliesByWorkspace :many
SELECT * FROM quick_replies
WHERE workspace_id = $1
ORDER BY shortcut ASC;

-- name: UpdateQuickReply :one
UPDATE quick_replies
SET shortcut = $2, body = $3, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: DeleteQuickReply :exec
DELETE FROM quick_replies WHERE id = $1;

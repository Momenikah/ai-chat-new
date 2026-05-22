-- name: CreateInternalNote :one
INSERT INTO internal_notes (conversation_id, author_id, body)
VALUES ($1, $2, $3)
RETURNING *;

-- name: ListInternalNotesByConversation :many
SELECT n.*, u.name AS author_name, u.email AS author_email
FROM internal_notes n
LEFT JOIN users u ON u.id = n.author_id
WHERE n.conversation_id = $1
ORDER BY n.created_at DESC;

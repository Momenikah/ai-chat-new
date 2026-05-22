-- name: CreateConversation :one
INSERT INTO conversations (workspace_id, channel_id, contact_id, status)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetConversationByID :one
SELECT * FROM conversations WHERE id = $1;

-- name: ListConversationsByWorkspace :many
SELECT c.*,
       co.name AS contact_name,
       co.avatar_url AS contact_avatar_url,
       ch.type AS channel_type,
       ch.name AS channel_name
FROM conversations c
JOIN contacts co ON co.id = c.contact_id
JOIN channels ch ON ch.id = c.channel_id
WHERE c.workspace_id = $1
ORDER BY c.last_message_at DESC NULLS LAST
LIMIT 200;

-- name: UpdateConversationStatus :one
UPDATE conversations
SET status = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: AssignConversation :one
UPDATE conversations
SET assigned_agent_id = $2, updated_at = now()
WHERE id = $1
RETURNING *;

-- name: TouchConversationLastMessage :exec
UPDATE conversations
SET last_message_at = now(),
    last_message_preview = $2,
    updated_at = now()
WHERE id = $1;

-- name: IncrementConversationUnread :exec
UPDATE conversations
SET unread_count = unread_count + 1, updated_at = now()
WHERE id = $1;

-- name: ResetConversationUnread :exec
UPDATE conversations
SET unread_count = 0, updated_at = now()
WHERE id = $1;

-- name: RecordAssignment :exec
INSERT INTO conversation_assignments (conversation_id, assigned_to, assigned_by)
VALUES ($1, $2, $3);

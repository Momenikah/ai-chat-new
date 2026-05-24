-- name: CreateWebhookLog :one
INSERT INTO webhook_logs
    (workspace_id, channel_id, provider, direction, event_type, status_code, payload, error_message)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: ListWebhookLogsByChannel :many
SELECT * FROM webhook_logs
WHERE channel_id = $1
ORDER BY received_at DESC
LIMIT 100;

-- name: UpdateMessageStatusByExternal :exec
UPDATE messages
SET status = $2
WHERE external_id = $1;

-- name: GetMessageByExternalID :one
SELECT * FROM messages
WHERE external_id = $1
LIMIT 1;

-- name: FindChannelByPhoneNumberID :one
SELECT * FROM channels
WHERE type = 'whatsapp' AND external_id = $1
LIMIT 1;

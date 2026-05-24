-- name: CreateChannel :one
INSERT INTO channels (workspace_id, type, name, status, external_id)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetChannelByID :one
SELECT * FROM channels
WHERE id = $1;

-- name: ListChannelsByWorkspace :many
SELECT * FROM channels
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: UpdateChannel :one
UPDATE channels
SET name              = $2,
    status            = $3,
    external_id       = $4,
    error_message     = $5,
    last_connected_at = $6,
    updated_at        = now()
WHERE id = $1
RETURNING *;

-- name: DeleteChannel :exec
DELETE FROM channels
WHERE id = $1;

-- name: UpsertChannelCredentials :exec
INSERT INTO channel_credentials (channel_id, ciphertext, nonce)
VALUES ($1, $2, $3)
ON CONFLICT (channel_id)
DO UPDATE SET ciphertext = EXCLUDED.ciphertext,
              nonce      = EXCLUDED.nonce,
              updated_at = now();

-- name: GetChannelCredentials :one
SELECT * FROM channel_credentials
WHERE channel_id = $1;

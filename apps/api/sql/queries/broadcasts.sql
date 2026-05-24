-- name: CreateBroadcastCampaign :one
INSERT INTO broadcast_campaigns
    (workspace_id, channel_id, template_id, name, audience_kind, audience_filter,
     body_override, variables, rate_per_minute, created_by)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetBroadcastCampaignByID :one
SELECT * FROM broadcast_campaigns WHERE id = $1;

-- name: ListBroadcastCampaignsByWorkspace :many
SELECT * FROM broadcast_campaigns
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: UpdateBroadcastStatus :one
UPDATE broadcast_campaigns
SET status        = $2,
    scheduled_at  = COALESCE($3, scheduled_at),
    started_at    = COALESCE($4, started_at),
    completed_at  = COALESCE($5, completed_at),
    updated_at    = now()
WHERE id = $1
RETURNING *;

-- name: SetBroadcastTotalRecipients :exec
UPDATE broadcast_campaigns
SET total_recipients = $2, updated_at = now()
WHERE id = $1;

-- name: IncrementBroadcastCounter :exec
UPDATE broadcast_campaigns
SET sent_count      = sent_count      + CASE WHEN $2 = 'sent'      THEN 1 ELSE 0 END,
    delivered_count = delivered_count + CASE WHEN $2 = 'delivered' THEN 1 ELSE 0 END,
    read_count      = read_count      + CASE WHEN $2 = 'read'      THEN 1 ELSE 0 END,
    failed_count    = failed_count    + CASE WHEN $2 = 'failed'    THEN 1 ELSE 0 END,
    reply_count     = reply_count     + CASE WHEN $2 = 'reply'     THEN 1 ELSE 0 END,
    updated_at      = now()
WHERE id = $1;

-- name: CreateBroadcastRecipient :one
INSERT INTO broadcast_recipients
    (campaign_id, workspace_id, contact_id, name, phone, external_id,
     variables, rendered_body, status, enqueued_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
RETURNING *;

-- name: ListBroadcastRecipients :many
SELECT * FROM broadcast_recipients
WHERE campaign_id = $1
ORDER BY created_at ASC
LIMIT 1000;

-- name: UpdateRecipientStatus :exec
UPDATE broadcast_recipients
SET status              = $2,
    external_message_id = COALESCE($3, external_message_id),
    last_error          = $4,
    sent_at             = CASE WHEN $2 = 'sent'      THEN now() ELSE sent_at END,
    delivered_at        = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END,
    read_at             = CASE WHEN $2 = 'read'      THEN now() ELSE read_at END,
    failed_at           = CASE WHEN $2 = 'failed'    THEN now() ELSE failed_at END,
    attempts            = attempts + CASE WHEN $5 THEN 1 ELSE 0 END
WHERE id = $1;

-- name: AppendBroadcastLog :exec
INSERT INTO broadcast_logs (campaign_id, recipient_id, event, detail)
VALUES ($1, $2, $3, $4);

-- name: ListBroadcastLogs :many
SELECT * FROM broadcast_logs
WHERE campaign_id = $1
ORDER BY occurred_at DESC
LIMIT 200;

-- name: CreateMessageQueueRow :one
INSERT INTO message_queue (workspace_id, kind, payload, scheduled_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: MarkMessageQueueStarted :exec
UPDATE message_queue
SET status = 'processing', started_at = now(), attempts = attempts + 1
WHERE id = $1;

-- name: MarkMessageQueueDone :exec
UPDATE message_queue
SET status = 'done', completed_at = now(), error = NULL
WHERE id = $1;

-- name: MarkMessageQueueFailed :exec
UPDATE message_queue
SET status = 'failed', completed_at = now(), error = $2
WHERE id = $1;

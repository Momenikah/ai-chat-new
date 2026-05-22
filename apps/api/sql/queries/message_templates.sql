-- name: CreateMessageTemplate :one
INSERT INTO message_templates (
    workspace_id, name, category, status, language,
    header_kind, header_content, body, footer, buttons, created_by
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
RETURNING *;

-- name: GetMessageTemplateByID :one
SELECT * FROM message_templates WHERE id = $1;

-- name: ListMessageTemplatesByWorkspace :many
SELECT * FROM message_templates
WHERE workspace_id = $1
ORDER BY updated_at DESC;

-- name: UpdateMessageTemplate :one
UPDATE message_templates
SET name = $2, category = $3, language = $4,
    header_kind = $5, header_content = $6, body = $7, footer = $8,
    buttons = $9, updated_at = now()
WHERE id = $1 AND status IN ('draft', 'rejected')
RETURNING *;

-- name: UpdateMessageTemplateStatus :one
UPDATE message_templates
SET status            = $2,
    submitted_at      = COALESCE($3, submitted_at),
    approved_at       = COALESCE($4, approved_at),
    rejection_reason  = $5,
    external_id       = COALESCE($6, external_id),
    updated_at        = now()
WHERE id = $1
RETURNING *;

-- name: DeleteMessageTemplate :exec
DELETE FROM message_templates WHERE id = $1;

-- name: AddTemplateVariable :one
INSERT INTO template_variables (template_id, name, label, sample_value, position)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: ListTemplateVariables :many
SELECT * FROM template_variables
WHERE template_id = $1
ORDER BY position ASC;

-- name: ClearTemplateVariables :exec
DELETE FROM template_variables WHERE template_id = $1;

-- name: LogTemplateUsage :exec
INSERT INTO template_usage_logs
    (template_id, workspace_id, conversation_id, used_by, variables, rendered_body)
VALUES ($1, $2, $3, $4, $5, $6);

-- name: ListTemplateUsage :many
SELECT * FROM template_usage_logs
WHERE template_id = $1
ORDER BY used_at DESC
LIMIT 100;

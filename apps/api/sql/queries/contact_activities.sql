-- name: CreateContactActivity :one
INSERT INTO contact_activities (contact_id, workspace_id, actor_id, kind, body, metadata)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: ListContactActivities :many
SELECT a.*, u.name AS actor_name
FROM contact_activities a
LEFT JOIN users u ON u.id = a.actor_id
WHERE a.contact_id = $1
ORDER BY a.occurred_at DESC
LIMIT 200;

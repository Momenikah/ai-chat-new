-- name: UpsertAgentPresence :exec
INSERT INTO agent_presence (user_id, workspace_id, status, last_seen_at, updated_at)
VALUES ($1, $2, $3, now(), now())
ON CONFLICT (user_id, workspace_id) DO UPDATE
SET status       = EXCLUDED.status,
    last_seen_at = now(),
    updated_at   = now();

-- name: ListPresenceByWorkspace :many
SELECT p.user_id, p.workspace_id, p.status, p.last_seen_at, p.updated_at,
       u.name AS user_name, u.email AS user_email
FROM agent_presence p
JOIN users u ON u.id = p.user_id
WHERE p.workspace_id = $1;

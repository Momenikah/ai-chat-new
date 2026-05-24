-- name: CreateSegment :one
INSERT INTO segments (workspace_id, name, description, color, created_by)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetSegmentByID :one
SELECT * FROM segments WHERE id = $1;

-- name: ListSegmentsByWorkspace :many
SELECT * FROM segments WHERE workspace_id = $1 ORDER BY name ASC;

-- name: DeleteSegment :exec
DELETE FROM segments WHERE id = $1 AND workspace_id = $2;

-- name: AddSegmentRule :one
INSERT INTO segment_rules (segment_id, field, operator, value)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: ListSegmentRules :many
SELECT * FROM segment_rules WHERE segment_id = $1 ORDER BY created_at ASC;

-- name: ClearSegmentRules :exec
DELETE FROM segment_rules WHERE segment_id = $1;

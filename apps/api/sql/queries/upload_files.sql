-- name: CreateUploadFile :one
INSERT INTO upload_files
    (workspace_id, uploaded_by, kind, original_name, stored_path, mime_type, size_bytes, url)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetUploadFileByID :one
SELECT * FROM upload_files
WHERE id = $1;

-- name: ListUploadFilesByWorkspace :many
SELECT * FROM upload_files
WHERE workspace_id = $1
ORDER BY created_at DESC;

-- name: DeleteUploadFile :exec
DELETE FROM upload_files
WHERE id = $1 AND workspace_id = $2;

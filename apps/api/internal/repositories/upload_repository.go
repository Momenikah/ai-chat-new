package repositories

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/models"
)

// UploadRepository handles persistence for uploaded files metadata.
type UploadRepository struct {
	db DBTX
}

// NewUploadRepository constructs an UploadRepository.
func NewUploadRepository(db DBTX) *UploadRepository {
	return &UploadRepository{db: db}
}

const uploadColumns = `
	id::text, workspace_id::text, uploaded_by::text, kind, original_name,
	stored_path, mime_type, size_bytes, url, created_at`

// CreateUploadParams holds inputs for inserting an upload record.
type CreateUploadParams struct {
	WorkspaceID  string
	UploadedBy   *string
	Kind         string
	OriginalName string
	StoredPath   string
	MimeType     string
	SizeBytes    int64
	URL          string
}

// Create inserts an upload-file record.
func (r *UploadRepository) Create(ctx context.Context, p CreateUploadParams) (*models.UploadFile, error) {
	const q = `
		INSERT INTO upload_files
			(workspace_id, uploaded_by, kind, original_name, stored_path, mime_type, size_bytes, url)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING ` + uploadColumns
	var f models.UploadFile
	err := r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.UploadedBy, p.Kind, p.OriginalName,
		p.StoredPath, p.MimeType, p.SizeBytes, p.URL).
		Scan(&f.ID, &f.WorkspaceID, &f.UploadedBy, &f.Kind, &f.OriginalName,
			&f.StoredPath, &f.MimeType, &f.SizeBytes, &f.URL, &f.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &f, nil
}

// GetByID fetches an upload-file record by id.
func (r *UploadRepository) GetByID(ctx context.Context, id string) (*models.UploadFile, error) {
	const q = `SELECT ` + uploadColumns + ` FROM upload_files WHERE id = $1`
	var f models.UploadFile
	err := r.db.QueryRow(ctx, q, id).
		Scan(&f.ID, &f.WorkspaceID, &f.UploadedBy, &f.Kind, &f.OriginalName,
			&f.StoredPath, &f.MimeType, &f.SizeBytes, &f.URL, &f.CreatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &f, nil
}

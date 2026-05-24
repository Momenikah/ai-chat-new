package repositories

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aichat/api/internal/models"
)

// APIKeyRepository persists developer API keys + usage logs.
type APIKeyRepository struct {
	db DBTX
}

// NewAPIKeyRepository constructs an APIKeyRepository.
func NewAPIKeyRepository(db DBTX) *APIKeyRepository {
	return &APIKeyRepository{db: db}
}

const apiKeyColumns = `
	id::text, workspace_id::text, name, prefix, scopes,
	created_by::text, last_used_at, revoked_at, created_at, updated_at`

// CreateAPIKeyParams holds inputs for inserting a key. KeyHash is the
// already-derived SHA-256 hex; the plain key never reaches the DB.
type CreateAPIKeyParams struct {
	WorkspaceID string
	Name        string
	Prefix      string
	KeyHash     string
	Scopes      []string
	CreatedBy   *string
}

// Create inserts a new key row and returns the model (without the secret).
func (r *APIKeyRepository) Create(ctx context.Context, p CreateAPIKeyParams) (*models.APIKey, error) {
	if p.Scopes == nil {
		p.Scopes = []string{}
	}
	const q = `INSERT INTO api_keys (workspace_id, name, prefix, key_hash, scopes, created_by)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + apiKeyColumns
	return scanAPIKey(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, p.Prefix, p.KeyHash, p.Scopes, p.CreatedBy,
	))
}

// ListByWorkspace returns all keys (active + revoked) of a workspace.
func (r *APIKeyRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.APIKey, error) {
	const q = `SELECT ` + apiKeyColumns + ` FROM api_keys
		WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.APIKey{}
	for rows.Next() {
		k, err := scanAPIKeyRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *k)
	}
	return out, rows.Err()
}

// GetByID returns one key.
func (r *APIKeyRepository) GetByID(ctx context.Context, id string) (*models.APIKey, error) {
	const q = `SELECT ` + apiKeyColumns + ` FROM api_keys WHERE id = $1`
	return scanAPIKey(r.db.QueryRow(ctx, q, id))
}

// FindActiveByHash resolves an unrevoked key by its hashed plaintext.
// Used by the API-key middleware on every authenticated request.
func (r *APIKeyRepository) FindActiveByHash(ctx context.Context, hash string) (*models.APIKey, error) {
	const q = `SELECT ` + apiKeyColumns + ` FROM api_keys
		WHERE key_hash = $1 AND revoked_at IS NULL`
	return scanAPIKey(r.db.QueryRow(ctx, q, hash))
}

// Revoke marks a key as revoked (soft-delete; we keep usage history).
func (r *APIKeyRepository) Revoke(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE api_keys SET revoked_at = now(), updated_at = now()
		 WHERE id = $1 AND revoked_at IS NULL`, id)
	return err
}

// TouchLastUsed updates last_used_at. Best-effort: callers ignore errors.
func (r *APIKeyRepository) TouchLastUsed(ctx context.Context, id string, at time.Time) error {
	_, err := r.db.Exec(ctx,
		`UPDATE api_keys SET last_used_at = $2 WHERE id = $1`, id, at)
	return err
}

/* ----------------------------- usage log ------------------------------ */

// CreateUsageLogParams captures one public-API request.
type CreateUsageLogParams struct {
	WorkspaceID  string
	APIKeyID     *string
	Method       string
	Path         string
	StatusCode   int
	LatencyMs    int
	IP           *string
	UserAgent    *string
	ErrorMessage *string
}

// CreateUsageLog persists a usage log row.
func (r *APIKeyRepository) CreateUsageLog(ctx context.Context, p CreateUsageLogParams) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO api_usage_logs
			(workspace_id, api_key_id, method, path, status_code, latency_ms, ip, user_agent, error_message)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		p.WorkspaceID, p.APIKeyID, p.Method, p.Path, p.StatusCode,
		p.LatencyMs, p.IP, p.UserAgent, p.ErrorMessage,
	)
	return err
}

// ListUsageLogs returns recent usage rows for the workspace dashboard.
func (r *APIKeyRepository) ListUsageLogs(ctx context.Context, workspaceID string, limit int) ([]models.APIUsageLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	const q = `SELECT id::text, workspace_id::text, api_key_id::text, method, path,
		status_code, latency_ms, ip, user_agent, error_message, created_at
		FROM api_usage_logs
		WHERE workspace_id = $1
		ORDER BY created_at DESC LIMIT $2`
	rows, err := r.db.Query(ctx, q, workspaceID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.APIUsageLog{}
	for rows.Next() {
		var l models.APIUsageLog
		if err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.APIKeyID, &l.Method, &l.Path,
			&l.StatusCode, &l.LatencyMs, &l.IP, &l.UserAgent, &l.ErrorMessage,
			&l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// CountUsageSince counts public-API requests on/after `since` for a
// workspace (used by the usage dashboard).
func (r *APIKeyRepository) CountUsageSince(ctx context.Context, workspaceID string, since time.Time) (int64, error) {
	var n int64
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM api_usage_logs WHERE workspace_id = $1 AND created_at >= $2`,
		workspaceID, since).Scan(&n)
	return n, err
}

/* ------------------------------ helpers ------------------------------- */

func scanAPIKey(row pgx.Row) (*models.APIKey, error) {
	k, err := scanAPIKeyRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return k, nil
}

func scanAPIKeyRow(row pgx.Row) (*models.APIKey, error) {
	var k models.APIKey
	if err := row.Scan(
		&k.ID, &k.WorkspaceID, &k.Name, &k.Prefix, &k.Scopes,
		&k.CreatedBy, &k.LastUsedAt, &k.RevokedAt, &k.CreatedAt, &k.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if k.Scopes == nil {
		k.Scopes = []string{}
	}
	return &k, nil
}

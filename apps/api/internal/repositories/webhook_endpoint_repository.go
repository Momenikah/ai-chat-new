package repositories

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aichat/api/internal/models"
)

// WebhookEndpointRepository persists outbound webhook endpoints +
// delivery logs (Part 10 — separate from the inbound provider webhook
// audit log in WebhookLogRepository).
type WebhookEndpointRepository struct {
	db DBTX
}

// NewWebhookEndpointRepository constructs a WebhookEndpointRepository.
func NewWebhookEndpointRepository(db DBTX) *WebhookEndpointRepository {
	return &WebhookEndpointRepository{db: db}
}

const webhookEndpointColumns = `
	id::text, workspace_id::text, name, url, secret, events, enabled, headers,
	created_by::text, last_delivery_at, last_status, failure_count,
	created_at, updated_at`

// CreateWebhookEndpointParams holds inputs for inserting an endpoint.
type CreateWebhookEndpointParams struct {
	WorkspaceID string
	Name        string
	URL         string
	Secret      string
	Events      []string
	Enabled     bool
	Headers     json.RawMessage
	CreatedBy   *string
}

// Create inserts a new endpoint row.
func (r *WebhookEndpointRepository) Create(ctx context.Context, p CreateWebhookEndpointParams) (*models.WebhookEndpoint, error) {
	if p.Events == nil {
		p.Events = []string{}
	}
	if len(p.Headers) == 0 {
		p.Headers = json.RawMessage(`{}`)
	}
	const q = `INSERT INTO webhook_endpoints
		(workspace_id, name, url, secret, events, enabled, headers, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING ` + webhookEndpointColumns
	return scanWebhookEndpoint(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, p.URL, p.Secret, p.Events, p.Enabled,
		p.Headers, p.CreatedBy,
	))
}

// UpdateWebhookEndpointParams holds the editable fields of an endpoint.
type UpdateWebhookEndpointParams struct {
	ID      string
	Name    string
	URL     string
	Events  []string
	Enabled bool
	Headers json.RawMessage
}

// Update saves edits to an endpoint. Secret rotation is a separate call.
func (r *WebhookEndpointRepository) Update(ctx context.Context, p UpdateWebhookEndpointParams) (*models.WebhookEndpoint, error) {
	if p.Events == nil {
		p.Events = []string{}
	}
	if len(p.Headers) == 0 {
		p.Headers = json.RawMessage(`{}`)
	}
	const q = `UPDATE webhook_endpoints
		SET name = $2, url = $3, events = $4, enabled = $5, headers = $6, updated_at = now()
		WHERE id = $1
		RETURNING ` + webhookEndpointColumns
	return scanWebhookEndpoint(r.db.QueryRow(ctx, q,
		p.ID, p.Name, p.URL, p.Events, p.Enabled, p.Headers,
	))
}

// RotateSecret replaces the HMAC secret used to sign deliveries.
func (r *WebhookEndpointRepository) RotateSecret(ctx context.Context, id, secret string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE webhook_endpoints SET secret = $2, updated_at = now() WHERE id = $1`,
		id, secret)
	return err
}

// Delete removes an endpoint (cascades to delivery logs).
func (r *WebhookEndpointRepository) Delete(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM webhook_endpoints WHERE id = $1`, id)
	return err
}

// GetByID fetches one endpoint.
func (r *WebhookEndpointRepository) GetByID(ctx context.Context, id string) (*models.WebhookEndpoint, error) {
	const q = `SELECT ` + webhookEndpointColumns + ` FROM webhook_endpoints WHERE id = $1`
	return scanWebhookEndpoint(r.db.QueryRow(ctx, q, id))
}

// ListByWorkspace returns all endpoints owned by a workspace.
func (r *WebhookEndpointRepository) ListByWorkspace(ctx context.Context, workspaceID string) ([]models.WebhookEndpoint, error) {
	const q = `SELECT ` + webhookEndpointColumns + ` FROM webhook_endpoints
		WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.WebhookEndpoint{}
	for rows.Next() {
		ep, err := scanWebhookEndpointRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *ep)
	}
	return out, rows.Err()
}

// FindByEvent returns the enabled endpoints subscribed to `event` in the
// workspace. Used by the dispatcher to fan out a single event.
func (r *WebhookEndpointRepository) FindByEvent(ctx context.Context, workspaceID string, event string) ([]models.WebhookEndpoint, error) {
	const q = `SELECT ` + webhookEndpointColumns + ` FROM webhook_endpoints
		WHERE workspace_id = $1 AND enabled = TRUE AND $2 = ANY(events)`
	rows, err := r.db.Query(ctx, q, workspaceID, event)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.WebhookEndpoint{}
	for rows.Next() {
		ep, err := scanWebhookEndpointRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *ep)
	}
	return out, rows.Err()
}

// RecordDelivery updates the endpoint's last-delivery snapshot. `success`
// resets the failure_count; failure increments it monotonically.
func (r *WebhookEndpointRepository) RecordDelivery(ctx context.Context, id string, at time.Time, status int, success bool) error {
	const q = `UPDATE webhook_endpoints
		SET last_delivery_at = $2,
		    last_status = $3,
		    failure_count = CASE WHEN $4 THEN 0 ELSE failure_count + 1 END,
		    updated_at = now()
		WHERE id = $1`
	_, err := r.db.Exec(ctx, q, id, at, status, success)
	return err
}

/* ----------------------- delivery log methods ------------------------ */

// CreateDeliveryLogParams holds inputs for inserting a delivery log.
type CreateDeliveryLogParams struct {
	WorkspaceID       string
	WebhookEndpointID string
	Event             string
	Payload           json.RawMessage
	StatusCode        *int
	Attempt           int
	Succeeded         bool
	ResponseBody      *string
	ErrorMessage      *string
	DurationMs        int
}

// CreateDeliveryLog inserts a delivery log row.
func (r *WebhookEndpointRepository) CreateDeliveryLog(ctx context.Context, p CreateDeliveryLogParams) error {
	if len(p.Payload) == 0 {
		p.Payload = json.RawMessage(`{}`)
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO webhook_delivery_logs
			(workspace_id, webhook_endpoint_id, event, payload, status_code,
			 attempt, succeeded, response_body, error_message, duration_ms)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		p.WorkspaceID, p.WebhookEndpointID, p.Event, p.Payload, p.StatusCode,
		p.Attempt, p.Succeeded, p.ResponseBody, p.ErrorMessage, p.DurationMs,
	)
	return err
}

// ListDeliveryLogs returns the most recent attempts for one endpoint.
func (r *WebhookEndpointRepository) ListDeliveryLogs(ctx context.Context, endpointID string, limit int) ([]models.WebhookDeliveryLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	const q = `SELECT id::text, workspace_id::text, webhook_endpoint_id::text,
		event, payload, status_code, attempt, succeeded, response_body,
		error_message, duration_ms, created_at
		FROM webhook_delivery_logs
		WHERE webhook_endpoint_id = $1
		ORDER BY created_at DESC LIMIT $2`
	rows, err := r.db.Query(ctx, q, endpointID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.WebhookDeliveryLog{}
	for rows.Next() {
		var l models.WebhookDeliveryLog
		if err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.WebhookEndpointID, &l.Event, &l.Payload,
			&l.StatusCode, &l.Attempt, &l.Succeeded, &l.ResponseBody,
			&l.ErrorMessage, &l.DurationMs, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

/* ----------------------------- scan helpers --------------------------- */

func scanWebhookEndpoint(row pgx.Row) (*models.WebhookEndpoint, error) {
	ep, err := scanWebhookEndpointRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return ep, nil
}

func scanWebhookEndpointRow(row pgx.Row) (*models.WebhookEndpoint, error) {
	var ep models.WebhookEndpoint
	if err := row.Scan(
		&ep.ID, &ep.WorkspaceID, &ep.Name, &ep.URL, &ep.Secret, &ep.Events,
		&ep.Enabled, &ep.Headers, &ep.CreatedBy, &ep.LastDeliveryAt,
		&ep.LastStatus, &ep.FailureCount, &ep.CreatedAt, &ep.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if ep.Events == nil {
		ep.Events = []string{}
	}
	if len(ep.Headers) == 0 {
		ep.Headers = json.RawMessage(`{}`)
	}
	return &ep, nil
}

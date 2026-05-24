package models

import (
	"encoding/json"
	"time"
)

// APIKey is one developer API key for a workspace. The `key_hash` column
// holds SHA-256 of the secret part of the key; the secret itself is shown
// to the operator exactly once at creation. `Prefix` is the first ~12
// characters of the key, kept for display purposes.
type APIKey struct {
	ID          string     `json:"id"`
	WorkspaceID string     `json:"workspace_id"`
	Name        string     `json:"name"`
	Prefix      string     `json:"prefix"`
	Scopes      []string   `json:"scopes"`
	CreatedBy   *string    `json:"created_by"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	RevokedAt   *time.Time `json:"revoked_at"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}

// IsActive reports whether the key can still authenticate.
func (k *APIKey) IsActive() bool { return k.RevokedAt == nil }

// APIUsageLog is one public-API request, persisted for the operator-facing
// activity feed and for debugging integrations.
type APIUsageLog struct {
	ID           string    `json:"id"`
	WorkspaceID  string    `json:"workspace_id"`
	APIKeyID     *string   `json:"api_key_id"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	StatusCode   int       `json:"status_code"`
	LatencyMs    int       `json:"latency_ms"`
	IP           *string   `json:"ip"`
	UserAgent    *string   `json:"user_agent"`
	ErrorMessage *string   `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

// WebhookEndpoint is one outbound webhook subscription owned by a workspace.
// `Secret` is plain-text on purpose so the operator can paste it into the
// receiving system; it never leaves the workspace surface.
type WebhookEndpoint struct {
	ID             string          `json:"id"`
	WorkspaceID    string          `json:"workspace_id"`
	Name           string          `json:"name"`
	URL            string          `json:"url"`
	Secret         string          `json:"secret"`
	Events         []string        `json:"events"`
	Enabled        bool            `json:"enabled"`
	Headers        json.RawMessage `json:"headers"`
	CreatedBy      *string         `json:"created_by"`
	LastDeliveryAt *time.Time      `json:"last_delivery_at"`
	LastStatus     *int            `json:"last_status"`
	FailureCount   int             `json:"failure_count"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// WebhookDeliveryLog is one attempt to deliver one event to one endpoint.
// A single event with 3 retries produces 3 rows so the operator can see
// the full attempt history.
type WebhookDeliveryLog struct {
	ID                string    `json:"id"`
	WorkspaceID       string    `json:"workspace_id"`
	WebhookEndpointID string    `json:"webhook_endpoint_id"`
	Event             string    `json:"event"`
	Payload           json.RawMessage `json:"payload"`
	StatusCode        *int      `json:"status_code"`
	Attempt           int       `json:"attempt"`
	Succeeded         bool      `json:"succeeded"`
	ResponseBody      *string   `json:"response_body"`
	ErrorMessage      *string   `json:"error_message"`
	DurationMs        int       `json:"duration_ms"`
	CreatedAt         time.Time `json:"created_at"`
}

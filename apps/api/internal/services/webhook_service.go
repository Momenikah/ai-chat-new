package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"net/url"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/webhook"
)

// Webhook service errors.
var (
	ErrWebhookNotFound   = errors.New("webhook endpoint not found")
	ErrInvalidWebhookURL = errors.New("webhook url must be a valid http(s) url")
	ErrInvalidEvent      = errors.New("unknown webhook event")
)

// WebhookService manages outbound webhook endpoints + exposes the
// dispatcher for a manual "test" delivery.
type WebhookService struct {
	endpoints  *repositories.WebhookEndpointRepository
	dispatcher webhook.Dispatcher
	plan       PlanEnforcer
}

// NewWebhookService constructs a WebhookService.
func NewWebhookService(repo *repositories.WebhookEndpointRepository, dispatcher webhook.Dispatcher) *WebhookService {
	if dispatcher == nil {
		dispatcher = webhook.NoopDispatcher{}
	}
	return &WebhookService{endpoints: repo, dispatcher: dispatcher}
}

// SetPlanEnforcer wires plan-feature enforcement. Optional (nil = allow).
func (s *WebhookService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// CreateWebhookInput is the payload for registering an endpoint.
type CreateWebhookInput struct {
	WorkspaceID string
	ActorID     string
	Name        string
	URL         string
	Events      []string
	Enabled     bool
	Headers     json.RawMessage
}

// Create validates + persists a new endpoint, generating a fresh HMAC
// secret. The secret is visible on the endpoint surface so the operator
// can configure the receiving end.
func (s *WebhookService) Create(ctx context.Context, in CreateWebhookInput) (*models.WebhookEndpoint, error) {
	// Outbound webhooks (n8n integration) are a gated feature.
	if err := ensureFeature(s.plan, ctx, in.WorkspaceID, FeatureN8N); err != nil {
		return nil, err
	}
	if err := validateURL(in.URL); err != nil {
		return nil, err
	}
	if err := validateEvents(in.Events); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = "Webhook"
	}
	secret, err := generateWebhookSecret()
	if err != nil {
		return nil, err
	}
	actor := in.ActorID
	return s.endpoints.Create(ctx, repositories.CreateWebhookEndpointParams{
		WorkspaceID: in.WorkspaceID,
		Name:        name,
		URL:         strings.TrimSpace(in.URL),
		Secret:      secret,
		Events:      in.Events,
		Enabled:     in.Enabled,
		Headers:     in.Headers,
		CreatedBy:   &actor,
	})
}

// UpdateWebhookInput is the payload for editing an endpoint.
type UpdateWebhookInput struct {
	ID      string
	Name    string
	URL     string
	Events  []string
	Enabled bool
	Headers json.RawMessage
}

// Update saves edits to an endpoint.
func (s *WebhookService) Update(ctx context.Context, in UpdateWebhookInput) (*models.WebhookEndpoint, error) {
	if err := validateURL(in.URL); err != nil {
		return nil, err
	}
	if err := validateEvents(in.Events); err != nil {
		return nil, err
	}
	return s.endpoints.Update(ctx, repositories.UpdateWebhookEndpointParams{
		ID:      in.ID,
		Name:    strings.TrimSpace(in.Name),
		URL:     strings.TrimSpace(in.URL),
		Events:  in.Events,
		Enabled: in.Enabled,
		Headers: in.Headers,
	})
}

// RotateSecret generates a new HMAC secret for an endpoint.
func (s *WebhookService) RotateSecret(ctx context.Context, id string) (*models.WebhookEndpoint, error) {
	secret, err := generateWebhookSecret()
	if err != nil {
		return nil, err
	}
	if err := s.endpoints.RotateSecret(ctx, id, secret); err != nil {
		return nil, err
	}
	return s.endpoints.GetByID(ctx, id)
}

// List returns all endpoints of a workspace.
func (s *WebhookService) List(ctx context.Context, workspaceID string) ([]models.WebhookEndpoint, error) {
	return s.endpoints.ListByWorkspace(ctx, workspaceID)
}

// Get returns one endpoint.
func (s *WebhookService) Get(ctx context.Context, id string) (*models.WebhookEndpoint, error) {
	ep, err := s.endpoints.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrWebhookNotFound
		}
		return nil, err
	}
	return ep, nil
}

// Delete removes an endpoint.
func (s *WebhookService) Delete(ctx context.Context, id string) error {
	return s.endpoints.Delete(ctx, id)
}

// DeliveryLogs returns recent attempts for an endpoint.
func (s *WebhookService) DeliveryLogs(ctx context.Context, endpointID string, limit int) ([]models.WebhookDeliveryLog, error) {
	return s.endpoints.ListDeliveryLogs(ctx, endpointID, limit)
}

// Test fires a synthetic `ping`-style payload at a single endpoint via the
// dispatcher so the operator can validate connectivity from the dashboard.
func (s *WebhookService) Test(ctx context.Context, workspaceID, endpointID string) error {
	ep, err := s.endpoints.GetByID(ctx, endpointID)
	if err != nil {
		return ErrWebhookNotFound
	}
	if ep.WorkspaceID != workspaceID {
		return ErrWebhookNotFound
	}
	// Use the first subscribed event as the test event so the receiver's
	// routing logic gets exercised; fall back to message.received.
	event := webhook.EventMessageReceived
	if len(ep.Events) > 0 && webhook.IsValidEvent(ep.Events[0]) {
		event = webhook.Event(ep.Events[0])
	}
	s.dispatcher.Emit(workspaceID, event, map[string]any{
		"test":    true,
		"message": "This is a test delivery from AI Chat.",
	})
	return nil
}

/* ----------------------------- validation ----------------------------- */

func validateURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return ErrInvalidWebhookURL
	}
	return nil
}

func validateEvents(events []string) error {
	if len(events) == 0 {
		return ErrInvalidEvent
	}
	for _, e := range events {
		if !webhook.IsValidEvent(e) {
			return ErrInvalidEvent
		}
	}
	return nil
}

func generateWebhookSecret() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return "whsec_" + hex.EncodeToString(buf), nil
}

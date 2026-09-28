package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
	"github.com/aichat/api/internal/webhook"
)

// WebhookEndpointHandler exposes outbound-webhook management endpoints.
type WebhookEndpointHandler struct {
	webhooks *services.WebhookService
}

// NewWebhookEndpointHandler constructs a WebhookEndpointHandler.
func NewWebhookEndpointHandler(s *services.WebhookService) *WebhookEndpointHandler {
	return &WebhookEndpointHandler{webhooks: s}
}

type createWebhookRequest struct {
	Name    string            `json:"name" validate:"required,min=1,max=80"`
	URL     string            `json:"url" validate:"required,url,max=500"`
	Events  []string          `json:"events" validate:"required,min=1,dive,max=40"`
	Enabled *bool             `json:"enabled"`
	Headers map[string]string `json:"headers"`
}

// Events handles GET /webhook-events — the catalogue of emit-able events.
// Static, no workspace scope needed beyond auth.
func (h *WebhookEndpointHandler) Events(c echo.Context) error {
	out := make([]string, 0, len(webhook.AllEvents))
	for _, e := range webhook.AllEvents {
		out = append(out, string(e))
	}
	return utils.OK(c, map[string]any{"events": out})
}

// List handles GET /workspaces/:id/webhook-endpoints.
func (h *WebhookEndpointHandler) List(c echo.Context) error {
	list, err := h.webhooks.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat webhook")
	}
	return utils.OK(c, map[string]any{"endpoints": list})
}

// Create handles POST /workspaces/:id/webhook-endpoints.
func (h *WebhookEndpointHandler) Create(c echo.Context) error {
	var req createWebhookRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	ep, err := h.webhooks.Create(c.Request().Context(), services.CreateWebhookInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Name:        req.Name,
		URL:         req.URL,
		Events:      req.Events,
		Enabled:     enabled,
		Headers:     marshalHeaders(req.Headers),
	})
	if err != nil {
		return mapWebhookError(c, err)
	}
	return utils.Created(c, ep)
}

// Update handles PATCH /webhook-endpoints/:id (workspace resolved by mw).
func (h *WebhookEndpointHandler) Update(c echo.Context) error {
	var req createWebhookRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}
	ep, err := h.webhooks.Update(c.Request().Context(), services.UpdateWebhookInput{
		ID:      c.Param("id"),
		Name:    req.Name,
		URL:     req.URL,
		Events:  req.Events,
		Enabled: enabled,
		Headers: marshalHeaders(req.Headers),
	})
	if err != nil {
		return mapWebhookError(c, err)
	}
	return utils.OK(c, ep)
}

// Delete handles DELETE /webhook-endpoints/:id.
func (h *WebhookEndpointHandler) Delete(c echo.Context) error {
	if err := h.webhooks.Delete(c.Request().Context(), c.Param("id")); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus webhook")
	}
	return c.NoContent(http.StatusNoContent)
}

// RotateSecret handles POST /webhook-endpoints/:id/rotate-secret.
func (h *WebhookEndpointHandler) RotateSecret(c echo.Context) error {
	ep, err := h.webhooks.RotateSecret(c.Request().Context(), c.Param("id"))
	if err != nil {
		return mapWebhookError(c, err)
	}
	return utils.OK(c, ep)
}

// Test handles POST /webhook-endpoints/:id/test.
func (h *WebhookEndpointHandler) Test(c echo.Context) error {
	if err := h.webhooks.Test(c.Request().Context(), middleware.WorkspaceID(c), c.Param("id")); err != nil {
		return mapWebhookError(c, err)
	}
	return utils.OK(c, map[string]any{"queued": true})
}

// DeliveryLogs handles GET /webhook-endpoints/:id/deliveries.
func (h *WebhookEndpointHandler) DeliveryLogs(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	logs, err := h.webhooks.DeliveryLogs(c.Request().Context(), c.Param("id"), limit)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat log pengiriman")
	}
	return utils.OK(c, map[string]any{"deliveries": logs})
}

func marshalHeaders(h map[string]string) json.RawMessage {
	if len(h) == 0 {
		return json.RawMessage(`{}`)
	}
	b, err := json.Marshal(h)
	if err != nil {
		return json.RawMessage(`{}`)
	}
	return b
}

func mapWebhookError(c echo.Context, err error) error {
	if resp, handled := handlePlanError(c, err); handled {
		return resp
	}
	switch {
	case errors.Is(err, services.ErrWebhookNotFound):
		return utils.Error(c, http.StatusNotFound, "not_found", "Webhook tidak ditemukan")
	case errors.Is(err, services.ErrInvalidWebhookURL):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_url", "URL webhook tidak valid")
	case errors.Is(err, services.ErrPrivateWebhookURL):
		return utils.Error(c, http.StatusUnprocessableEntity, "private_url",
			"URL webhook harus mengarah ke host publik (bukan localhost/jaringan privat)")
	case errors.Is(err, services.ErrInvalidEvent):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_event", "Event webhook tidak dikenal")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses webhook")
}

package handlers

import (
	"errors"
	"io"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
	"github.com/aichat/api/internal/wagateway"
)

// GatewayHandler exposes the unofficial WhatsApp gateway (OneSender /
// StarSender) endpoints.
type GatewayHandler struct {
	gateway *services.GatewayService
}

// NewGatewayHandler constructs a GatewayHandler.
func NewGatewayHandler(s *services.GatewayService) *GatewayHandler {
	return &GatewayHandler{gateway: s}
}

type gatewayConnectRequest struct {
	Provider    string `json:"provider" validate:"required,oneof=onesender starsender"`
	ChannelID   string `json:"channel_id" validate:"omitempty,uuid"`
	Name        string `json:"name" validate:"required,min=2,max=80"`
	APIKey      string `json:"api_key" validate:"required,max=512"`
	BaseURL     string `json:"base_url" validate:"omitempty,max=512"`
	PhoneNumber string `json:"phone_number" validate:"omitempty,max=32"`
}

type gatewayTestRequest struct {
	To   string `json:"to" validate:"required,min=6,max=32"`
	Body string `json:"body" validate:"required,max=1000"`
}

// Connect handles POST /api/v1/workspaces/:id/channels/gateway/connect.
func (h *GatewayHandler) Connect(c echo.Context) error {
	var req gatewayConnectRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	info, err := h.gateway.Connect(c.Request().Context(), services.GatewayConnectInput{
		WorkspaceID: middleware.WorkspaceID(c),
		Provider:    wagateway.Provider(req.Provider),
		ChannelID:   req.ChannelID,
		Name:        req.Name,
		APIKey:      req.APIKey,
		BaseURL:     req.BaseURL,
		PhoneNumber: req.PhoneNumber,
	})
	if err != nil {
		return mapGatewayError(c, err)
	}
	return utils.Created(c, info)
}

// Info handles GET /api/v1/channels/:id/gateway.
func (h *GatewayHandler) Info(c echo.Context) error {
	info, err := h.gateway.Info(c.Request().Context(), middleware.ChannelID(c))
	if err != nil {
		return mapGatewayError(c, err)
	}
	return utils.OK(c, info)
}

// RotateToken handles POST /api/v1/channels/:id/gateway/rotate-token.
func (h *GatewayHandler) RotateToken(c echo.Context) error {
	info, err := h.gateway.RotateWebhookToken(c.Request().Context(), middleware.ChannelID(c))
	if err != nil {
		return mapGatewayError(c, err)
	}
	return utils.OK(c, info)
}

// Test handles POST /api/v1/channels/:id/gateway/test.
func (h *GatewayHandler) Test(c echo.Context) error {
	var req gatewayTestRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if err := h.gateway.SendTest(c.Request().Context(), middleware.ChannelID(c), req.To, req.Body); err != nil {
		if errors.Is(err, services.ErrGatewayNotFound) || errors.Is(err, wagateway.ErrMissingCredentials) {
			return mapGatewayError(c, err)
		}
		// The gateway's own error explains what to fix (wrong key,
		// device offline, …), so pass it through.
		return utils.Error(c, http.StatusBadGateway, "gateway_error", err.Error())
	}
	return utils.OK(c, map[string]any{"sent": true})
}

// ReceiveWebhook handles POST /api/webhooks/wa-gateway/:channelId/:token.
func (h *GatewayHandler) ReceiveWebhook(c echo.Context) error {
	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.NoContent(http.StatusBadRequest)
	}
	res, err := h.gateway.HandleWebhook(c.Request().Context(), c.Param("channelId"), c.Param("token"), raw)
	switch {
	case errors.Is(err, services.ErrGatewayNotFound), errors.Is(err, services.ErrGatewayUnauthorized):
		// Same response for both so the URL space can't be probed.
		return utils.Error(c, http.StatusNotFound, "not_found", "Webhook tidak ditemukan")
	case err != nil:
		return utils.Error(c, http.StatusBadRequest, "bad_request", "Payload webhook tidak valid")
	}
	return utils.OK(c, res)
}

// VerifyWebhook handles GET on the webhook URL, which some gateway
// dashboards call to check the URL before saving it.
func (h *GatewayHandler) VerifyWebhook(c echo.Context) error {
	info, err := h.gateway.Info(c.Request().Context(), c.Param("channelId"))
	if err != nil || info.WebhookURL != h.gateway.WebhookURL(c.Param("channelId"), c.Param("token")) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Webhook tidak ditemukan")
	}
	return utils.OK(c, map[string]any{"ok": true})
}

func mapGatewayError(c echo.Context, err error) error {
	if resp, handled := handlePlanError(c, err); handled {
		return resp
	}
	switch {
	case errors.Is(err, services.ErrGatewayNotFound), errors.Is(err, wagateway.ErrMissingCredentials):
		return utils.Error(c, http.StatusNotFound, "not_found", "Channel gateway tidak ditemukan")
	case errors.Is(err, services.ErrGatewayUnknownProvider):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_provider", "Provider harus onesender atau starsender")
	case errors.Is(err, services.ErrGatewayPrivateURL):
		return utils.Error(c, http.StatusUnprocessableEntity, "private_url",
			"URL OneSender harus mengarah ke host publik (bukan localhost/jaringan privat)")
	case errors.Is(err, wagateway.ErrInvalidCredentials):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_credentials",
			"API key wajib diisi; OneSender juga membutuhkan URL instance yang valid (http/https)")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses channel gateway")
}

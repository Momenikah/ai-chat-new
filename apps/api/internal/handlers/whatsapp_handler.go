package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
	"github.com/aichat/api/internal/whatsapp"
)

// WhatsAppHandler exposes the WhatsApp Cloud API endpoints: webhook
// verify/receive, channel connect and explicit send.
type WhatsAppHandler struct {
	whatsapp *services.WhatsAppService
}

// NewWhatsAppHandler constructs a WhatsAppHandler.
func NewWhatsAppHandler(s *services.WhatsAppService) *WhatsAppHandler {
	return &WhatsAppHandler{whatsapp: s}
}

type connectRequest struct {
	Name               string `json:"name" validate:"required,min=2,max=80"`
	PhoneNumberID      string `json:"phone_number_id" validate:"required"`
	BusinessAccountID  string `json:"business_account_id"`
	AccessToken        string `json:"access_token" validate:"required"`
	WebhookVerifyToken string `json:"webhook_verify_token"`
}

type sendRequest struct {
	ChannelID      string `json:"channel_id" validate:"required,uuid"`
	ConversationID string `json:"conversation_id" validate:"required,uuid"`
	Body           string `json:"body" validate:"required,max=4000"`
}

// VerifyWebhook handles GET /api/webhooks/whatsapp. Meta calls this once
// during webhook setup with `hub.mode=subscribe&hub.verify_token=…
// &hub.challenge=…` and expects the challenge echoed back as plain text.
func (h *WhatsAppHandler) VerifyWebhook(c echo.Context) error {
	mode := c.QueryParam("hub.mode")
	token := c.QueryParam("hub.verify_token")
	challenge := c.QueryParam("hub.challenge")
	out, err := h.whatsapp.VerifyWebhook(mode, token, challenge)
	if err != nil {
		return utils.Error(c, http.StatusForbidden, "forbidden", err.Error())
	}
	return c.String(http.StatusOK, out)
}

// ReceiveWebhook handles POST /api/webhooks/whatsapp. The raw body is
// captured before JSON parsing so the App Secret signature can be
// verified end-to-end.
func (h *WhatsAppHandler) ReceiveWebhook(c echo.Context) error {
	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.NoContent(http.StatusBadRequest)
	}
	if sig := c.Request().Header.Get("X-Hub-Signature-256"); sig != "" {
		if err := h.whatsapp.VerifySignature(raw, sig); err != nil {
			return utils.Error(c, http.StatusUnauthorized,
				"invalid_signature", "Signature header tidak valid")
		}
	}

	var env whatsapp.WebhookEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		// We still return 200 to Meta so they don't retry a malformed body.
		return c.NoContent(http.StatusOK)
	}

	if _, _, err := h.whatsapp.HandleIncoming(c.Request().Context(), raw, env); err != nil {
		// Internal error: still 200 OK to Meta (handled async).
		return c.NoContent(http.StatusOK)
	}
	return c.NoContent(http.StatusOK)
}

// Connect handles POST /api/v1/workspaces/:id/channels/whatsapp/connect.
func (h *WhatsAppHandler) Connect(c echo.Context) error {
	var req connectRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	channel, err := h.whatsapp.Connect(c.Request().Context(), services.ConnectInput{
		WorkspaceID:        middleware.WorkspaceID(c),
		Name:               req.Name,
		PhoneNumberID:      req.PhoneNumberID,
		BusinessAccountID:  req.BusinessAccountID,
		AccessToken:        req.AccessToken,
		WebhookVerifyToken: req.WebhookVerifyToken,
	})
	if err != nil {
		if resp, handled := handlePlanError(c, err); handled {
			return resp
		}
		return utils.Error(c, http.StatusUnprocessableEntity,
			"connect_failed", err.Error())
	}
	return utils.Created(c, map[string]any{
		"channel":     channel,
		"webhook_url": h.whatsapp.WebhookURL(),
	})
}

// Send handles POST /api/v1/channels/whatsapp/send.
//
// This is an explicit, channel-specific entry point per the Part 5 spec.
// The inbox composer continues to use /conversations/:id/messages, which
// MessageService routes through this same WhatsApp deliverer when the
// channel is WhatsApp.
func (h *WhatsAppHandler) Send(c echo.Context) error {
	var req sendRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	msg, err := h.whatsapp.Deliver(c.Request().Context(), services.DeliverInput{
		ChannelID:      req.ChannelID,
		ConversationID: req.ConversationID,
		SenderUserID:   middleware.UserID(c),
		Body:           req.Body,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrConversationNotFound):
			return utils.Error(c, http.StatusNotFound, "not_found", "Percakapan tidak ditemukan")
		case errors.Is(err, services.ErrContactMissingPhone):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"no_phone", "Kontak belum punya nomor telepon")
		case errors.Is(err, whatsapp.ErrMissingCredentials):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"no_credentials", "Channel WhatsApp belum dikonfigurasi")
		case strings.HasPrefix(err.Error(), "forbidden"):
			return utils.Error(c, http.StatusForbidden, "forbidden",
				"Anda bukan anggota workspace ini")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal mengirim pesan WhatsApp")
		}
	}
	return utils.Created(c, msg)
}

// ListChannels handles GET /api/v1/workspaces/:id/channels/whatsapp.
// Thin wrapper that filters the workspace's channels to type=whatsapp and
// adds the public webhook URL for setup display.
func (h *WhatsAppHandler) ListChannels(c echo.Context) error {
	return utils.OK(c, map[string]any{
		"webhook_url": h.whatsapp.WebhookURL(),
		"setup_doc":   "Lihat README bagian 'Meta WhatsApp Cloud API setup'.",
	})
}

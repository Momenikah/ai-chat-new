package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/messenger"
	"github.com/aichat/api/internal/meta"
	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// MessengerHandler exposes the Facebook Messenger endpoints.
type MessengerHandler struct {
	messenger *services.MessengerService
}

// NewMessengerHandler constructs a MessengerHandler.
func NewMessengerHandler(s *services.MessengerService) *MessengerHandler {
	return &MessengerHandler{messenger: s}
}

type messengerConnectRequest struct {
	Name               string `json:"name" validate:"required,min=2,max=80"`
	PageID             string `json:"page_id" validate:"required"`
	PageAccessToken    string `json:"page_access_token" validate:"required"`
	WebhookVerifyToken string `json:"webhook_verify_token"`
}

// VerifyWebhook handles GET /api/webhooks/messenger.
func (h *MessengerHandler) VerifyWebhook(c echo.Context) error {
	mode := c.QueryParam("hub.mode")
	token := c.QueryParam("hub.verify_token")
	challenge := c.QueryParam("hub.challenge")
	out, err := h.messenger.VerifyWebhook(mode, token, challenge)
	if err != nil {
		return utils.Error(c, http.StatusForbidden, "forbidden", err.Error())
	}
	return c.String(http.StatusOK, out)
}

// ReceiveWebhook handles POST /api/webhooks/messenger.
func (h *MessengerHandler) ReceiveWebhook(c echo.Context) error {
	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.NoContent(http.StatusBadRequest)
	}
	if sig := c.Request().Header.Get("X-Hub-Signature-256"); sig != "" {
		if err := h.messenger.VerifySignature(raw, sig); err != nil {
			return utils.Error(c, http.StatusUnauthorized,
				"invalid_signature", "Signature header tidak valid")
		}
	}
	var env meta.WebhookEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return c.NoContent(http.StatusOK)
	}
	_ = h.messenger.HandleIncoming(c.Request().Context(), raw, env)
	return c.NoContent(http.StatusOK)
}

// Connect handles POST /api/v1/workspaces/:id/channels/messenger/connect.
func (h *MessengerHandler) Connect(c echo.Context) error {
	var req messengerConnectRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	channel, err := h.messenger.Connect(c.Request().Context(), services.MessengerConnectInput{
		WorkspaceID:        middleware.WorkspaceID(c),
		Name:               req.Name,
		PageID:             req.PageID,
		PageAccessToken:    req.PageAccessToken,
		WebhookVerifyToken: req.WebhookVerifyToken,
	})
	if err != nil {
		return utils.Error(c, http.StatusUnprocessableEntity,
			"connect_failed", err.Error())
	}
	return utils.Created(c, map[string]any{
		"channel":     channel,
		"webhook_url": h.messenger.WebhookURL(),
	})
}

// Send handles POST /api/v1/channels/messenger/send.
func (h *MessengerHandler) Send(c echo.Context) error {
	var req metaSendRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	msg, err := h.messenger.Deliver(c.Request().Context(), services.DeliverInput{
		ChannelID:      req.ChannelID,
		ConversationID: req.ConversationID,
		SenderUserID:   middleware.UserID(c),
		Body:           req.Body,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrConversationNotFound):
			return utils.Error(c, http.StatusNotFound, "not_found", "Percakapan tidak ditemukan")
		case errors.Is(err, messenger.ErrMissingCredentials):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"no_credentials", "Channel Messenger belum dikonfigurasi")
		case strings.HasPrefix(err.Error(), "forbidden"):
			return utils.Error(c, http.StatusForbidden, "forbidden",
				"Anda bukan anggota workspace ini")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal mengirim pesan Messenger")
		}
	}
	return utils.Created(c, msg)
}

// Info handles GET /api/v1/workspaces/:id/channels/messenger.
func (h *MessengerHandler) Info(c echo.Context) error {
	return utils.OK(c, map[string]any{
		"webhook_url": h.messenger.WebhookURL(),
		"setup_doc":   "Lihat README bagian 'Instagram + Messenger Meta App setup'.",
	})
}

package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/instagram"
	"github.com/aichat/api/internal/meta"
	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// InstagramHandler exposes the Instagram Messaging endpoints.
type InstagramHandler struct {
	instagram *services.InstagramService
}

// NewInstagramHandler constructs an InstagramHandler.
func NewInstagramHandler(s *services.InstagramService) *InstagramHandler {
	return &InstagramHandler{instagram: s}
}

type instagramConnectRequest struct {
	Name                string `json:"name" validate:"required,min=2,max=80"`
	InstagramBusinessID string `json:"instagram_business_id" validate:"required"`
	PageID              string `json:"page_id"`
	PageAccessToken     string `json:"page_access_token" validate:"required"`
	WebhookVerifyToken  string `json:"webhook_verify_token"`
}

type metaSendRequest struct {
	ChannelID      string `json:"channel_id"`
	ConversationID string `json:"conversation_id" validate:"required,uuid"`
	Body           string `json:"body" validate:"required,max=4000"`
}

// VerifyWebhook handles GET /api/webhooks/instagram.
func (h *InstagramHandler) VerifyWebhook(c echo.Context) error {
	mode := c.QueryParam("hub.mode")
	token := c.QueryParam("hub.verify_token")
	challenge := c.QueryParam("hub.challenge")
	out, err := h.instagram.VerifyWebhook(mode, token, challenge)
	if err != nil {
		return utils.Error(c, http.StatusForbidden, "forbidden", err.Error())
	}
	return c.String(http.StatusOK, out)
}

// ReceiveWebhook handles POST /api/webhooks/instagram.
func (h *InstagramHandler) ReceiveWebhook(c echo.Context) error {
	raw, err := io.ReadAll(c.Request().Body)
	if err != nil {
		return c.NoContent(http.StatusBadRequest)
	}
	if sig := c.Request().Header.Get("X-Hub-Signature-256"); sig != "" {
		if err := h.instagram.VerifySignature(raw, sig); err != nil {
			return utils.Error(c, http.StatusUnauthorized,
				"invalid_signature", "Signature header tidak valid")
		}
	}
	var env meta.WebhookEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return c.NoContent(http.StatusOK)
	}
	_ = h.instagram.HandleIncoming(c.Request().Context(), raw, env)
	return c.NoContent(http.StatusOK)
}

// Connect handles POST /api/v1/workspaces/:id/channels/instagram/connect.
func (h *InstagramHandler) Connect(c echo.Context) error {
	var req instagramConnectRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	channel, err := h.instagram.Connect(c.Request().Context(), services.InstagramConnectInput{
		WorkspaceID:         middleware.WorkspaceID(c),
		Name:                req.Name,
		InstagramBusinessID: req.InstagramBusinessID,
		PageID:              req.PageID,
		PageAccessToken:     req.PageAccessToken,
		WebhookVerifyToken:  req.WebhookVerifyToken,
	})
	if err != nil {
		return utils.Error(c, http.StatusUnprocessableEntity,
			"connect_failed", err.Error())
	}
	return utils.Created(c, map[string]any{
		"channel":     channel,
		"webhook_url": h.instagram.WebhookURL(),
	})
}

// Send handles POST /api/v1/channels/instagram/send.
func (h *InstagramHandler) Send(c echo.Context) error {
	var req metaSendRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	msg, err := h.instagram.Deliver(c.Request().Context(), services.DeliverInput{
		ChannelID:      req.ChannelID,
		ConversationID: req.ConversationID,
		SenderUserID:   middleware.UserID(c),
		Body:           req.Body,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrConversationNotFound):
			return utils.Error(c, http.StatusNotFound, "not_found", "Percakapan tidak ditemukan")
		case errors.Is(err, instagram.ErrMissingCredentials):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"no_credentials", "Channel Instagram belum dikonfigurasi")
		case strings.HasPrefix(err.Error(), "forbidden"):
			return utils.Error(c, http.StatusForbidden, "forbidden",
				"Anda bukan anggota workspace ini")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal mengirim DM Instagram")
		}
	}
	return utils.Created(c, msg)
}

// Info handles GET /api/v1/workspaces/:id/channels/instagram.
func (h *InstagramHandler) Info(c echo.Context) error {
	return utils.OK(c, map[string]any{
		"webhook_url": h.instagram.WebhookURL(),
		"setup_doc":   "Lihat README bagian 'Instagram + Messenger Meta App setup'.",
	})
}

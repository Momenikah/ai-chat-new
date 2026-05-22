package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// MessageHandler exposes inbox message endpoints.
type MessageHandler struct {
	messages *services.MessageService
}

// NewMessageHandler constructs a MessageHandler.
func NewMessageHandler(messages *services.MessageService) *MessageHandler {
	return &MessageHandler{messages: messages}
}

type sendMessageRequest struct {
	Body string `json:"body" validate:"required,max=4000"`
	Kind string `json:"kind" validate:"omitempty,oneof=text image file audio video"`
}

// List handles GET /conversations/:id/messages.
func (h *MessageHandler) List(c echo.Context) error {
	list, err := h.messages.List(c.Request().Context(), middleware.ConversationID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat pesan")
	}
	return utils.OK(c, map[string]any{"messages": list})
}

// Send handles POST /conversations/:id/messages.
func (h *MessageHandler) Send(c echo.Context) error {
	var req sendMessageRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	kind := models.MessageKind(req.Kind)
	if kind == "" {
		kind = models.KindText
	}
	msg, err := h.messages.Send(c.Request().Context(), services.SendInput{
		ConversationID: middleware.ConversationID(c),
		SenderUserID:   middleware.UserID(c),
		Body:           req.Body,
		Kind:           kind,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrConversationNotFound):
			return utils.Error(c, http.StatusNotFound,
				"not_found", "Percakapan tidak ditemukan")
		case errors.Is(err, services.ErrEmptyMessage):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"empty_message", "Isi pesan tidak boleh kosong")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal mengirim pesan")
		}
	}
	return utils.Created(c, msg)
}

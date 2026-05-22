package handlers

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// PublicHandler implements the developer (API-key authenticated) endpoints
// under /api/v1. The workspace is resolved from the API key by the
// APIKeyMiddleware, so every handler reads middleware.WorkspaceID(c).
type PublicHandler struct {
	public *services.PublicAPIService
}

// NewPublicHandler constructs a PublicHandler.
func NewPublicHandler(s *services.PublicAPIService) *PublicHandler {
	return &PublicHandler{public: s}
}

type publicSendRequest struct {
	ConversationID string `json:"conversation_id" validate:"omitempty,uuid"`
	ChannelID      string `json:"channel_id" validate:"omitempty,uuid"`
	To             string `json:"to" validate:"omitempty,max=120"`
	Body           string `json:"body" validate:"required,max=4000"`
}

type publicTemplateRequest struct {
	ConversationID string            `json:"conversation_id" validate:"omitempty,uuid"`
	ChannelID      string            `json:"channel_id" validate:"omitempty,uuid"`
	To             string            `json:"to" validate:"omitempty,max=120"`
	TemplateID     string            `json:"template_id" validate:"required,uuid"`
	Variables      map[string]string `json:"variables"`
}

type publicContactRequest struct {
	Name    string  `json:"name" validate:"required,min=1,max=120"`
	Phone   *string `json:"phone" validate:"omitempty,max=32"`
	Email   *string `json:"email" validate:"omitempty,email,max=160"`
	Company *string `json:"company" validate:"omitempty,max=120"`
	Notes   *string `json:"notes" validate:"omitempty,max=2000"`
}

// SendMessage handles POST /api/v1/messages/send.
func (h *PublicHandler) SendMessage(c echo.Context) error {
	var req publicSendRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	msg, err := h.public.SendMessage(c.Request().Context(), services.SendMessageInput{
		WorkspaceID:    middleware.WorkspaceID(c),
		ConversationID: req.ConversationID,
		ChannelID:      req.ChannelID,
		To:             req.To,
		Body:           req.Body,
	})
	if err != nil {
		return mapPublicError(c, err)
	}
	return utils.Created(c, msg)
}

// SendTemplate handles POST /api/v1/messages/template.
func (h *PublicHandler) SendTemplate(c echo.Context) error {
	var req publicTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	msg, err := h.public.SendTemplate(c.Request().Context(), services.SendTemplateInput{
		WorkspaceID:    middleware.WorkspaceID(c),
		ConversationID: req.ConversationID,
		ChannelID:      req.ChannelID,
		To:             req.To,
		TemplateID:     req.TemplateID,
		Variables:      req.Variables,
	})
	if err != nil {
		return mapPublicError(c, err)
	}
	return utils.Created(c, msg)
}

// ListContacts handles GET /api/v1/contacts.
func (h *PublicHandler) ListContacts(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	offset, _ := strconv.Atoi(c.QueryParam("offset"))
	contacts, err := h.public.ListContacts(c.Request().Context(),
		middleware.WorkspaceID(c), c.QueryParam("search"), limit, offset)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat kontak")
	}
	return utils.OK(c, map[string]any{"contacts": contacts})
}

// CreateContact handles POST /api/v1/contacts.
func (h *PublicHandler) CreateContact(c echo.Context) error {
	var req publicContactRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	contact, err := h.public.CreateContact(c.Request().Context(), services.PublicCreateContactInput{
		WorkspaceID: middleware.WorkspaceID(c),
		Name:        req.Name,
		Phone:       req.Phone,
		Email:       req.Email,
		Company:     req.Company,
		Notes:       req.Notes,
	})
	if err != nil {
		return mapPublicError(c, err)
	}
	return utils.Created(c, contact)
}

// ListConversations handles GET /api/v1/conversations.
func (h *PublicHandler) ListConversations(c echo.Context) error {
	list, err := h.public.ListConversations(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat percakapan")
	}
	return utils.OK(c, map[string]any{"conversations": list})
}

// ListMessages handles GET /api/v1/conversations/:id/messages.
func (h *PublicHandler) ListMessages(c echo.Context) error {
	msgs, err := h.public.ListMessages(c.Request().Context(),
		middleware.WorkspaceID(c), c.Param("id"))
	if err != nil {
		return mapPublicError(c, err)
	}
	return utils.OK(c, map[string]any{"messages": msgs})
}

func mapPublicError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrConversationNotFound):
		return utils.Error(c, http.StatusNotFound, "not_found", "Percakapan tidak ditemukan")
	case errors.Is(err, services.ErrPublicForbidden):
		return utils.Error(c, http.StatusForbidden, "forbidden", "Resource bukan milik workspace ini")
	case errors.Is(err, services.ErrEmptyMessage):
		return utils.Error(c, http.StatusUnprocessableEntity, "empty_body", "Isi pesan tidak boleh kosong")
	case errors.Is(err, services.ErrChannelRequired):
		return utils.Error(c, http.StatusUnprocessableEntity, "channel_required", "channel_id wajib bila conversation_id kosong")
	case errors.Is(err, services.ErrRecipientRequired):
		return utils.Error(c, http.StatusUnprocessableEntity, "recipient_required", "`to` wajib bila conversation_id kosong")
	case errors.Is(err, services.ErrNoDeliverer):
		return utils.Error(c, http.StatusUnprocessableEntity, "no_deliverer", "Channel ini tidak mendukung pengiriman keluar")
	case errors.Is(err, services.ErrTemplateNotFound):
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses permintaan")
}

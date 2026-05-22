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

// ConversationHandler exposes inbox conversation endpoints.
type ConversationHandler struct {
	conversations *services.ConversationService
}

// NewConversationHandler constructs a ConversationHandler.
func NewConversationHandler(c *services.ConversationService) *ConversationHandler {
	return &ConversationHandler{conversations: c}
}

type updateStatusRequest struct {
	Status string `json:"status" validate:"required,oneof=open pending resolved spam"`
}

type assignRequest struct {
	// AgentID is the member to assign. Nil/empty unassigns the conversation.
	AgentID *string `json:"agent_id"`
}

// List handles GET /workspaces/:id/conversations.
func (h *ConversationHandler) List(c echo.Context) error {
	list, err := h.conversations.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat percakapan")
	}
	return utils.OK(c, map[string]any{"conversations": list})
}

// Get handles GET /conversations/:id.
func (h *ConversationHandler) Get(c echo.Context) error {
	detail, err := h.conversations.Get(c.Request().Context(), middleware.ConversationID(c))
	if err != nil {
		if errors.Is(err, services.ErrConversationNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Percakapan tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat percakapan")
	}
	return utils.OK(c, detail)
}

// UpdateStatus handles PATCH /conversations/:id/status.
func (h *ConversationHandler) UpdateStatus(c echo.Context) error {
	var req updateStatusRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	conv, err := h.conversations.UpdateStatus(c.Request().Context(),
		middleware.ConversationID(c), models.ConversationStatus(req.Status))
	if err != nil {
		if errors.Is(err, services.ErrInvalidStatus) {
			return utils.Error(c, http.StatusUnprocessableEntity,
				"invalid_status", "Status percakapan tidak valid")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memperbarui status")
	}
	return utils.OK(c, conv)
}

// Assign handles PATCH /conversations/:id/assign.
func (h *ConversationHandler) Assign(c echo.Context) error {
	var req assignRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	agentID := req.AgentID
	if agentID != nil && *agentID == "" {
		agentID = nil
	}
	conv, err := h.conversations.Assign(c.Request().Context(),
		middleware.ConversationID(c), agentID, middleware.UserID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal mengubah penugasan")
	}
	return utils.OK(c, conv)
}

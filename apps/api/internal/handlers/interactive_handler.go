package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// InteractiveHandler exposes interactive-message CRUD endpoints.
type InteractiveHandler struct {
	interactives *services.InteractiveService
}

// NewInteractiveHandler constructs an InteractiveHandler.
func NewInteractiveHandler(s *services.InteractiveService) *InteractiveHandler {
	return &InteractiveHandler{interactives: s}
}

type interactiveRequest struct {
	Name    string          `json:"name" validate:"required,min=2,max=80"`
	Kind    string          `json:"kind" validate:"required,oneof=reply_buttons list carousel"`
	Payload json.RawMessage `json:"payload"`
}

type interactiveUpdateRequest struct {
	Name    string          `json:"name" validate:"required,min=2,max=80"`
	Payload json.RawMessage `json:"payload"`
}

// List handles GET /workspaces/:id/interactive-messages.
func (h *InteractiveHandler) List(c echo.Context) error {
	list, err := h.interactives.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat interactive message")
	}
	return utils.OK(c, map[string]any{"interactive_messages": list})
}

// Create handles POST /workspaces/:id/interactive-messages.
func (h *InteractiveHandler) Create(c echo.Context) error {
	var req interactiveRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	im, err := h.interactives.Create(c.Request().Context(), services.CreateInteractiveInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Name:        req.Name,
		Kind:        req.Kind,
		Payload:     req.Payload,
	})
	if err != nil {
		return mapInteractiveError(c, err)
	}
	return utils.Created(c, im)
}

// Get handles GET /workspaces/:id/interactive-messages/:interactiveId.
func (h *InteractiveHandler) Get(c echo.Context) error {
	id := c.Param("interactiveId")
	im, err := h.interactives.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Interactive message tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat interactive message")
	}
	if im.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Interactive message tidak ditemukan")
	}
	return utils.OK(c, im)
}

// Update handles PATCH /workspaces/:id/interactive-messages/:interactiveId.
func (h *InteractiveHandler) Update(c echo.Context) error {
	var req interactiveUpdateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	id := c.Param("interactiveId")
	im, err := h.interactives.Get(c.Request().Context(), id)
	if err != nil || im.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Interactive message tidak ditemukan")
	}
	updated, err := h.interactives.Update(c.Request().Context(), id, req.Name, req.Payload)
	if err != nil {
		return mapInteractiveError(c, err)
	}
	return utils.OK(c, updated)
}

// Delete handles DELETE /workspaces/:id/interactive-messages/:interactiveId.
func (h *InteractiveHandler) Delete(c echo.Context) error {
	id := c.Param("interactiveId")
	im, err := h.interactives.Get(c.Request().Context(), id)
	if err != nil || im.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Interactive message tidak ditemukan")
	}
	if err := h.interactives.Delete(c.Request().Context(), id); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus interactive message")
	}
	return c.NoContent(http.StatusNoContent)
}

func mapInteractiveError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrInvalidInteractiveKind):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_kind", "Kind interactive tidak valid")
	case errors.Is(err, services.ErrEmptyInteractiveName):
		return utils.Error(c, http.StatusUnprocessableEntity, "empty_name", "Nama interactive tidak boleh kosong")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menyimpan interactive message")
}

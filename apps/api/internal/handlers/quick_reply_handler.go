package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// QuickReplyHandler exposes quick-reply CRUD endpoints.
type QuickReplyHandler struct {
	replies *services.QuickReplyService
}

// NewQuickReplyHandler constructs a QuickReplyHandler.
func NewQuickReplyHandler(s *services.QuickReplyService) *QuickReplyHandler {
	return &QuickReplyHandler{replies: s}
}

type quickReplyRequest struct {
	Shortcut string `json:"shortcut" validate:"required,min=1,max=32"`
	Body     string `json:"body" validate:"required,max=2000"`
}

// List handles GET /workspaces/:id/quick-replies.
func (h *QuickReplyHandler) List(c echo.Context) error {
	list, err := h.replies.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat quick reply")
	}
	return utils.OK(c, map[string]any{"quick_replies": list})
}

// Create handles POST /workspaces/:id/quick-replies.
func (h *QuickReplyHandler) Create(c echo.Context) error {
	var req quickReplyRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	r, err := h.replies.Create(c.Request().Context(), services.CreateQuickReplyInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Shortcut:    req.Shortcut,
		Body:        req.Body,
	})
	if err != nil {
		if errors.Is(err, services.ErrEmptyQuickReply) {
			return utils.Error(c, http.StatusUnprocessableEntity, "invalid", err.Error())
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuat quick reply")
	}
	return utils.Created(c, r)
}

// Update handles PATCH /workspaces/:id/quick-replies/:replyId.
func (h *QuickReplyHandler) Update(c echo.Context) error {
	var req quickReplyRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	id := c.Param("replyId")
	if err := h.assertOwnership(c, id); err != nil {
		return err
	}
	r, err := h.replies.Update(c.Request().Context(), id, req.Shortcut, req.Body)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memperbarui quick reply")
	}
	return utils.OK(c, r)
}

// Delete handles DELETE /workspaces/:id/quick-replies/:replyId.
func (h *QuickReplyHandler) Delete(c echo.Context) error {
	id := c.Param("replyId")
	if err := h.assertOwnership(c, id); err != nil {
		return err
	}
	if err := h.replies.Delete(c.Request().Context(), id); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus quick reply")
	}
	return c.NoContent(http.StatusNoContent)
}

// assertOwnership returns a 404 when the quick reply doesn't belong to the
// resolved workspace.
func (h *QuickReplyHandler) assertOwnership(c echo.Context, id string) error {
	qr, err := h.replies.Get(c.Request().Context(), id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Quick reply tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat quick reply")
	}
	if qr.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Quick reply tidak ditemukan")
	}
	return nil
}

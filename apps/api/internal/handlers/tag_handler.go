package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// TagHandler exposes tag CRUD endpoints.
type TagHandler struct {
	tags *services.TagService
}

// NewTagHandler constructs a TagHandler.
func NewTagHandler(tags *services.TagService) *TagHandler {
	return &TagHandler{tags: tags}
}

type createTagRequest struct {
	Name  string `json:"name" validate:"required,min=1,max=50"`
	Color string `json:"color" validate:"omitempty,hexcolor"`
}

// List handles GET /workspaces/:id/tags.
func (h *TagHandler) List(c echo.Context) error {
	list, err := h.tags.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat tag")
	}
	return utils.OK(c, map[string]any{"tags": list})
}

// Create handles POST /workspaces/:id/tags.
func (h *TagHandler) Create(c echo.Context) error {
	var req createTagRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	tag, err := h.tags.Create(c.Request().Context(),
		middleware.WorkspaceID(c), req.Name, req.Color)
	if err != nil {
		if errors.Is(err, services.ErrEmptyTagName) {
			return utils.Error(c, http.StatusUnprocessableEntity, "invalid", "Nama tag tidak boleh kosong")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuat tag")
	}
	return utils.Created(c, tag)
}

// Delete handles DELETE /workspaces/:id/tags/:tagId.
func (h *TagHandler) Delete(c echo.Context) error {
	tagID := c.Param("tagId")
	if err := h.tags.Delete(c.Request().Context(), tagID, middleware.WorkspaceID(c)); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus tag")
	}
	return c.NoContent(http.StatusNoContent)
}

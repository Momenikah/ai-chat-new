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

// WorkspaceHandler exposes workspace CRUD endpoints.
type WorkspaceHandler struct {
	workspaces *services.WorkspaceService
}

// NewWorkspaceHandler constructs a WorkspaceHandler.
func NewWorkspaceHandler(workspaces *services.WorkspaceService) *WorkspaceHandler {
	return &WorkspaceHandler{workspaces: workspaces}
}

type createWorkspaceRequest struct {
	Name       string `json:"name" validate:"required,min=2,max=80"`
	BrandColor string `json:"brand_color" validate:"omitempty,hexcolor"`
	Timezone   string `json:"timezone" validate:"omitempty,max=64"`
}

type updateWorkspaceRequest struct {
	Name       string  `json:"name" validate:"omitempty,min=2,max=80"`
	LogoURL    *string `json:"logo_url" validate:"omitempty"`
	BrandColor string  `json:"brand_color" validate:"omitempty,hexcolor"`
	Timezone   string  `json:"timezone" validate:"omitempty,max=64"`
}

// Create handles POST /workspaces.
func (h *WorkspaceHandler) Create(c echo.Context) error {
	var req createWorkspaceRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	ws, err := h.workspaces.Create(c.Request().Context(), middleware.UserID(c),
		services.CreateWorkspaceInput{
			Name:       req.Name,
			BrandColor: req.BrandColor,
			Timezone:   req.Timezone,
		})
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal membuat workspace")
	}
	return utils.Created(c, ws)
}

// List handles GET /workspaces.
func (h *WorkspaceHandler) List(c echo.Context) error {
	list, err := h.workspaces.ListForUser(c.Request().Context(), middleware.UserID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat daftar workspace")
	}
	return utils.OK(c, map[string]any{"workspaces": list})
}

// Get handles GET /workspaces/:id.
func (h *WorkspaceHandler) Get(c echo.Context) error {
	ws, err := h.workspaces.Get(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Workspace tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat workspace")
	}
	return utils.OK(c, map[string]any{
		"workspace":   ws,
		"member_role": middleware.MemberRole(c),
	})
}

// Update handles PATCH /workspaces/:id.
func (h *WorkspaceHandler) Update(c echo.Context) error {
	var req updateWorkspaceRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	ws, err := h.workspaces.Update(c.Request().Context(), middleware.WorkspaceID(c),
		services.UpdateWorkspaceInput{
			Name:       req.Name,
			LogoURL:    req.LogoURL,
			BrandColor: req.BrandColor,
			Timezone:   req.Timezone,
		})
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memperbarui workspace")
	}
	return utils.OK(c, ws)
}

// Delete handles DELETE /workspaces/:id.
func (h *WorkspaceHandler) Delete(c echo.Context) error {
	if err := h.workspaces.Delete(c.Request().Context(), middleware.WorkspaceID(c)); err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal menghapus workspace")
	}
	return c.NoContent(http.StatusNoContent)
}

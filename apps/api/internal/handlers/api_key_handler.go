package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// APIKeyHandler exposes developer API-key management endpoints.
type APIKeyHandler struct {
	keys *services.APIKeyService
}

// NewAPIKeyHandler constructs an APIKeyHandler.
func NewAPIKeyHandler(s *services.APIKeyService) *APIKeyHandler {
	return &APIKeyHandler{keys: s}
}

type createAPIKeyRequest struct {
	Name   string   `json:"name" validate:"required,min=1,max=80"`
	Scopes []string `json:"scopes" validate:"omitempty,dive,max=40"`
}

// List handles GET /workspaces/:id/api-keys.
func (h *APIKeyHandler) List(c echo.Context) error {
	list, err := h.keys.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat API key")
	}
	return utils.OK(c, map[string]any{"api_keys": list})
}

// Create handles POST /workspaces/:id/api-keys. Returns the plaintext key
// exactly once — it is never recoverable afterwards.
func (h *APIKeyHandler) Create(c echo.Context) error {
	var req createAPIKeyRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	created, err := h.keys.Create(c.Request().Context(), services.CreateAPIKeyInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Name:        req.Name,
		Scopes:      req.Scopes,
	})
	if err != nil {
		if resp, handled := handlePlanError(c, err); handled {
			return resp
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuat API key")
	}
	return utils.Created(c, created)
}

// UsageLogs handles GET /workspaces/:id/api-keys/usage.
func (h *APIKeyHandler) UsageLogs(c echo.Context) error {
	limit, _ := strconv.Atoi(c.QueryParam("limit"))
	logs, err := h.keys.UsageLogs(c.Request().Context(), middleware.WorkspaceID(c), limit)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat log penggunaan")
	}
	return utils.OK(c, map[string]any{"logs": logs})
}

// Revoke handles DELETE /api-keys/:id. Workspace ownership is enforced by
// the RequireAPIKeyRole middleware before this runs.
func (h *APIKeyHandler) Revoke(c echo.Context) error {
	if err := h.keys.Revoke(c.Request().Context(), c.Param("id")); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal mencabut API key")
	}
	return c.NoContent(http.StatusNoContent)
}

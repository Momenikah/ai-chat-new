package handlers

import (
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// DashboardHandler exposes dashboard metric endpoints.
type DashboardHandler struct {
	dashboard *services.DashboardService
}

// NewDashboardHandler constructs a DashboardHandler.
func NewDashboardHandler(dashboard *services.DashboardService) *DashboardHandler {
	return &DashboardHandler{dashboard: dashboard}
}

// Overview handles GET /workspaces/:id/overview.
func (h *DashboardHandler) Overview(c echo.Context) error {
	days := 7
	if raw := c.QueryParam("days"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed <= 0 || parsed > 90 {
			return utils.Error(c, http.StatusBadRequest,
				"invalid_days", "Rentang analytics harus antara 1 dan 90 hari")
		}
		days = parsed
	}
	overview, err := h.dashboard.Overview(c.Request().Context(), middleware.WorkspaceID(c), days)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat ringkasan dashboard")
	}
	return utils.OK(c, overview)
}

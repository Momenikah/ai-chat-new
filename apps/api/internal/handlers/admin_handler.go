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

// AdminHandler exposes the super-admin platform endpoints. All routes sit
// behind RequireAuth + RequireSuperAdmin.
type AdminHandler struct {
	admin *services.AdminService
}

// NewAdminHandler constructs an AdminHandler.
func NewAdminHandler(s *services.AdminService) *AdminHandler {
	return &AdminHandler{admin: s}
}

func (h *AdminHandler) actor(c echo.Context) services.Actor {
	return services.Actor{
		UserID: middleware.UserID(c),
		Email:  middleware.Email(c),
		IP:     c.RealIP(),
	}
}

func queryInt(c echo.Context, key string, def int) int {
	if v, err := strconv.Atoi(c.QueryParam(key)); err == nil && v > 0 {
		return v
	}
	return def
}

// Overview handles GET /admin/overview.
func (h *AdminHandler) Overview(c echo.Context) error {
	o, err := h.admin.Overview(c.Request().Context())
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat overview")
	}
	return utils.OK(c, o)
}

// Users handles GET /admin/users.
func (h *AdminHandler) Users(c echo.Context) error {
	list, err := h.admin.ListUsers(c.Request().Context(),
		c.QueryParam("search"), queryInt(c, "limit", 50), queryInt(c, "offset", 0))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat user")
	}
	return utils.OK(c, map[string]any{"users": list})
}

// Workspaces handles GET /admin/workspaces.
func (h *AdminHandler) Workspaces(c echo.Context) error {
	list, err := h.admin.ListWorkspaces(c.Request().Context(),
		c.QueryParam("search"), queryInt(c, "limit", 50), queryInt(c, "offset", 0))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat workspace")
	}
	return utils.OK(c, map[string]any{"workspaces": list})
}

// Subscriptions handles GET /admin/subscriptions.
func (h *AdminHandler) Subscriptions(c echo.Context) error {
	list, err := h.admin.ListSubscriptions(c.Request().Context(),
		queryInt(c, "limit", 50), queryInt(c, "offset", 0))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat subscription")
	}
	return utils.OK(c, map[string]any{"subscriptions": list})
}

// Channels handles GET /admin/channels.
func (h *AdminHandler) Channels(c echo.Context) error {
	list, err := h.admin.ListChannels(c.Request().Context(),
		queryInt(c, "limit", 50), queryInt(c, "offset", 0))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat channel")
	}
	return utils.OK(c, map[string]any{"channels": list})
}

// Logs handles GET /admin/logs. `type=webhook` returns webhook deliveries;
// otherwise system logs (optionally filtered by ?level=).
func (h *AdminHandler) Logs(c echo.Context) error {
	limit := queryInt(c, "limit", 100)
	if c.QueryParam("type") == "webhook" {
		list, err := h.admin.ListWebhookDeliveries(c.Request().Context(), limit)
		if err != nil {
			return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat webhook log")
		}
		return utils.OK(c, map[string]any{"webhook_logs": list})
	}
	list, err := h.admin.ListSystemLogs(c.Request().Context(), c.QueryParam("level"), limit)
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat system log")
	}
	return utils.OK(c, map[string]any{"system_logs": list})
}

// AuditLogs handles GET /admin/audit-logs.
func (h *AdminHandler) AuditLogs(c echo.Context) error {
	list, err := h.admin.ListAuditLogs(c.Request().Context(), queryInt(c, "limit", 100))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat audit log")
	}
	return utils.OK(c, map[string]any{"audit_logs": list})
}

// Reports handles GET /admin/reports.
func (h *AdminHandler) Reports(c echo.Context) error {
	list, err := h.admin.ListReports(c.Request().Context(),
		c.QueryParam("status"), queryInt(c, "limit", 100))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat laporan")
	}
	return utils.OK(c, map[string]any{"reports": list})
}

type suspendRequest struct {
	Suspended bool   `json:"suspended"`
	Reason    string `json:"reason" validate:"omitempty,max=500"`
}

// Suspend handles POST /admin/workspaces/:id/suspend.
func (h *AdminHandler) Suspend(c echo.Context) error {
	var req suspendRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	ws, err := h.admin.SetWorkspaceSuspended(c.Request().Context(),
		h.actor(c), c.Param("id"), req.Suspended, req.Reason)
	if err != nil {
		if errors.Is(err, services.ErrWorkspaceNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Workspace tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memperbarui workspace")
	}
	return utils.OK(c, ws)
}

type resolveReportRequest struct {
	Status string `json:"status" validate:"required,oneof=open reviewing resolved dismissed"`
	Note   string `json:"note" validate:"omitempty,max=1000"`
}

// ResolveReport handles POST /admin/reports/:id/resolve.
func (h *AdminHandler) ResolveReport(c echo.Context) error {
	var req resolveReportRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	report, err := h.admin.ResolveReport(c.Request().Context(),
		h.actor(c), c.Param("id"), req.Status, req.Note)
	if err != nil {
		if errors.Is(err, services.ErrReportNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Laporan tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memperbarui laporan")
	}
	return utils.OK(c, report)
}

// Impersonate handles POST /admin/users/:id/impersonate.
func (h *AdminHandler) Impersonate(c echo.Context) error {
	result, err := h.admin.Impersonate(c.Request().Context(), h.actor(c), c.Param("id"))
	if err != nil {
		if errors.Is(err, services.ErrUserNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "User tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal impersonate")
	}
	return utils.OK(c, result)
}

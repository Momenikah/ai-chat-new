package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// BillingHandler exposes pricing, subscription, usage and invoice endpoints.
type BillingHandler struct {
	billing *services.BillingService
}

// NewBillingHandler constructs a BillingHandler.
func NewBillingHandler(s *services.BillingService) *BillingHandler {
	return &BillingHandler{billing: s}
}

type changePlanRequest struct {
	PlanCode string `json:"plan_code" validate:"required,oneof=FREE BASIC LITE"`
}

// ListPlans handles GET /plans — the public pricing catalogue (no auth).
func (h *BillingHandler) ListPlans(c echo.Context) error {
	plans, err := h.billing.ListPlans(c.Request().Context())
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat paket")
	}
	return utils.OK(c, map[string]any{"plans": plans})
}

// GetBilling handles GET /workspaces/:id/billing.
func (h *BillingHandler) GetBilling(c echo.Context) error {
	summary, err := h.billing.GetBilling(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat billing")
	}
	return utils.OK(c, summary)
}

// ChangePlan handles POST /workspaces/:id/billing/change-plan.
func (h *BillingHandler) ChangePlan(c echo.Context) error {
	var req changePlanRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	result, err := h.billing.ChangePlan(c.Request().Context(),
		middleware.WorkspaceID(c), req.PlanCode)
	if err != nil {
		if errors.Is(err, services.ErrPlanNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Paket tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal mengubah paket")
	}
	return utils.OK(c, result)
}

// GetUsage handles GET /workspaces/:id/usage.
func (h *BillingHandler) GetUsage(c echo.Context) error {
	usage, err := h.billing.GetUsage(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat usage")
	}
	return utils.OK(c, usage)
}

// ListInvoices handles GET /workspaces/:id/invoices.
func (h *BillingHandler) ListInvoices(c echo.Context) error {
	invoices, err := h.billing.ListInvoices(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat invoice")
	}
	return utils.OK(c, map[string]any{"invoices": invoices})
}

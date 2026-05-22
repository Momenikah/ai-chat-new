package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// handlePlanError maps plan-enforcement errors to HTTP 402 (Payment
// Required) with an upgrade-friendly message. Returns (response, true)
// when the error was a plan error; otherwise (nil, false) so the caller
// falls through to its own error mapping.
func handlePlanError(c echo.Context, err error) (error, bool) {
	switch {
	case errors.Is(err, services.ErrPlanLimitReached):
		return utils.Error(c, http.StatusPaymentRequired, "plan_limit",
			"Batas paket Anda tercapai. Upgrade untuk menambah lebih banyak."), true
	case errors.Is(err, services.ErrFeatureNotInPlan):
		return utils.Error(c, http.StatusPaymentRequired, "feature_locked",
			"Fitur ini tidak tersedia di paket Anda. Silakan upgrade."), true
	}
	return nil, false
}

// errRequestHandled signals that a helper has already written the HTTP
// response. Returning it from a handler is safe: Echo's error handler
// is a no-op once the response is committed.
var errRequestHandled = errors.New("request already handled")

// bindAndValidate decodes the JSON body into dst and runs struct
// validation. On failure it writes the error response and returns
// errRequestHandled so the caller can simply `return err`.
func bindAndValidate(c echo.Context, dst interface{}) error {
	if err := c.Bind(dst); err != nil {
		_ = utils.Error(c, http.StatusBadRequest,
			"bad_request", "Body permintaan tidak valid")
		return errRequestHandled
	}
	if err := c.Validate(dst); err != nil {
		_ = utils.ValidationError(c, utils.FieldErrors(err))
		return errRequestHandled
	}
	return nil
}

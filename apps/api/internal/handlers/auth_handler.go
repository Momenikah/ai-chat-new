package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// AuthHandler exposes the authentication endpoints.
type AuthHandler struct {
	auth *services.AuthService
}

// NewAuthHandler constructs an AuthHandler.
func NewAuthHandler(auth *services.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

type registerRequest struct {
	WorkspaceName string `json:"workspace_name" validate:"required,min=2,max=80"`
	Name          string `json:"name" validate:"required,min=2,max=80"`
	Email         string `json:"email" validate:"required,email"`
	Password      string `json:"password" validate:"required,min=8,max=72"`
}

type loginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token" validate:"required"`
}

type logoutRequest struct {
	RefreshToken string `json:"refresh_token"`
}

// Register handles POST /auth/register.
func (h *AuthHandler) Register(c echo.Context) error {
	var req registerRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	result, err := h.auth.Register(c.Request().Context(), services.RegisterInput{
		WorkspaceName: req.WorkspaceName,
		Name:          req.Name,
		Email:         req.Email,
		Password:      req.Password,
	})
	if err != nil {
		if errors.Is(err, services.ErrEmailTaken) {
			return utils.Error(c, http.StatusConflict,
				"email_taken", "Email sudah terdaftar")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal membuat akun")
	}

	return utils.Created(c, result)
}

// Login handles POST /auth/login.
func (h *AuthHandler) Login(c echo.Context) error {
	var req loginRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	result, err := h.auth.Login(c.Request().Context(), req.Email, req.Password)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidCredentials):
			return utils.Error(c, http.StatusUnauthorized,
				"invalid_credentials", "Email atau password salah")
		case errors.Is(err, services.ErrUserInactive):
			return utils.Error(c, http.StatusForbidden,
				"user_inactive", "Akun Anda dinonaktifkan")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal masuk")
		}
	}

	return utils.OK(c, result)
}

// Refresh handles POST /auth/refresh.
func (h *AuthHandler) Refresh(c echo.Context) error {
	var req refreshRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	result, err := h.auth.Refresh(c.Request().Context(), req.RefreshToken)
	if err != nil {
		if errors.Is(err, services.ErrInvalidRefresh) || errors.Is(err, services.ErrUserInactive) {
			return utils.Error(c, http.StatusUnauthorized,
				"invalid_refresh", "Sesi tidak valid, silakan masuk kembali")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memperbarui sesi")
	}

	return utils.OK(c, result)
}

// Logout handles POST /auth/logout.
func (h *AuthHandler) Logout(c echo.Context) error {
	var req logoutRequest
	_ = c.Bind(&req) // logout is best-effort; body is optional

	if err := h.auth.Logout(c.Request().Context(), req.RefreshToken); err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal keluar")
	}
	return c.NoContent(http.StatusNoContent)
}

// Me handles GET /auth/me.
func (h *AuthHandler) Me(c echo.Context) error {
	user, err := h.auth.Me(c.Request().Context(), middleware.UserID(c))
	if err != nil {
		return utils.Error(c, http.StatusNotFound,
			"not_found", "Pengguna tidak ditemukan")
	}
	return utils.OK(c, user)
}

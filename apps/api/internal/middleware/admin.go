package middleware

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/utils"
)

// Context key for the resolved super-admin user.
const ContextKeySuperAdmin = "ctx_super_admin"

// AdminMiddleware gates the platform super-admin surface. It loads the
// authenticated user and verifies the is_super_admin flag — a platform
// role distinct from per-workspace MemberRole.
type AdminMiddleware struct {
	users *repositories.UserRepository
}

// NewAdminMiddleware constructs an AdminMiddleware.
func NewAdminMiddleware(users *repositories.UserRepository) *AdminMiddleware {
	return &AdminMiddleware{users: users}
}

// RequireSuperAdmin rejects any request whose user is not a super admin.
// Chain it AFTER RequireAuth (which populates the user id).
func (m *AdminMiddleware) RequireSuperAdmin() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			userID := UserID(c)
			if userID == "" {
				return utils.Error(c, http.StatusUnauthorized, "unauthorized", "Tidak terautentikasi")
			}
			user, err := m.users.GetByID(c.Request().Context(), userID)
			if err != nil || !user.IsSuperAdmin {
				// 404 (not 403) so the admin surface is invisible to
				// non-admins — we never confirm it exists.
				return utils.Error(c, http.StatusNotFound, "not_found", "Halaman tidak ditemukan")
			}
			c.Set(ContextKeySuperAdmin, user)
			return next(c)
		}
	}
}

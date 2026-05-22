// Package middleware contains Echo middleware: JWT authentication and
// workspace-scoped role-based authorization.
package middleware

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/auth"
	"github.com/aichat/api/internal/utils"
)

// Context keys under which request-scoped data is stored.
const (
	ContextKeyUserID      = "auth_user_id"
	ContextKeyEmail       = "auth_email"
	ContextKeyWorkspaceID = "ctx_workspace_id"
	ContextKeyMemberRole  = "ctx_member_role"
	ContextKeyChannelID      = "ctx_channel_id"
	ContextKeyConversationID = "ctx_conversation_id"
	ContextKeyContactID      = "ctx_contact_id"
)

// AuthMiddleware validates JWT access tokens.
type AuthMiddleware struct {
	tm *auth.TokenManager
}

// NewAuthMiddleware constructs an AuthMiddleware.
func NewAuthMiddleware(tm *auth.TokenManager) *AuthMiddleware {
	return &AuthMiddleware{tm: tm}
}

// RequireAuth rejects requests without a valid Bearer access token and
// populates the request context with the caller's identity.
func (m *AuthMiddleware) RequireAuth() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get("Authorization")
			if header == "" || !strings.HasPrefix(header, "Bearer ") {
				return utils.Error(c, http.StatusUnauthorized,
					"unauthorized", "Token akses tidak ditemukan")
			}

			claims, err := m.tm.ParseAccessToken(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				return utils.Error(c, http.StatusUnauthorized,
					"unauthorized", "Token akses tidak valid atau kedaluwarsa")
			}

			c.Set(ContextKeyUserID, claims.UserID)
			c.Set(ContextKeyEmail, claims.Email)
			return next(c)
		}
	}
}

// UserID returns the authenticated user's id from the request context.
func UserID(c echo.Context) string {
	v, _ := c.Get(ContextKeyUserID).(string)
	return v
}

// Email returns the authenticated user's email.
func Email(c echo.Context) string {
	v, _ := c.Get(ContextKeyEmail).(string)
	return v
}

// WorkspaceID returns the workspace id resolved by the workspace middleware.
func WorkspaceID(c echo.Context) string {
	v, _ := c.Get(ContextKeyWorkspaceID).(string)
	return v
}

// MemberRole returns the caller's role in the resolved workspace.
func MemberRole(c echo.Context) string {
	v, _ := c.Get(ContextKeyMemberRole).(string)
	return v
}

// ChannelID returns the channel id resolved by the channel middleware.
func ChannelID(c echo.Context) string {
	v, _ := c.Get(ContextKeyChannelID).(string)
	return v
}

// ConversationID returns the conversation id resolved by the
// conversation middleware.
func ConversationID(c echo.Context) string {
	v, _ := c.Get(ContextKeyConversationID).(string)
	return v
}

// ContactID returns the contact id resolved by the contact middleware.
func ContactID(c echo.Context) string {
	v, _ := c.Get(ContextKeyContactID).(string)
	return v
}

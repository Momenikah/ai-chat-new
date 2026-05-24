package handlers

import (
	"context"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/auth"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// WSHandler upgrades HTTP requests into WebSocket inbox connections.
//
// Auth: because browsers cannot set custom headers on WebSocket handshakes,
// the access token is passed as a `?token=` query parameter and validated
// alongside the requested `?workspace_id=` membership.
type WSHandler struct {
	hub      *realtime.Hub
	tokens   *auth.TokenManager
	members  *repositories.WorkspaceMemberRepository
	presence *services.PresenceService
}

// NewWSHandler constructs a WSHandler.
func NewWSHandler(
	hub *realtime.Hub,
	tokens *auth.TokenManager,
	members *repositories.WorkspaceMemberRepository,
	presence *services.PresenceService,
) *WSHandler {
	return &WSHandler{hub: hub, tokens: tokens, members: members, presence: presence}
}

// Handle handles GET /ws?workspace_id=…&token=….
func (h *WSHandler) Handle(c echo.Context) error {
	workspaceID := c.QueryParam("workspace_id")
	token := c.QueryParam("token")

	if workspaceID == "" || token == "" {
		return utils.Error(c, http.StatusBadRequest,
			"bad_request", "workspace_id dan token wajib disertakan")
	}

	claims, err := h.tokens.ParseAccessToken(token)
	if err != nil {
		return utils.Error(c, http.StatusUnauthorized,
			"unauthorized", "Token tidak valid")
	}

	// Verify the user is an active member of the requested workspace.
	member, err := h.members.Get(c.Request().Context(), workspaceID, claims.UserID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return utils.Error(c, http.StatusForbidden,
				"forbidden", "Anda bukan anggota workspace ini")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memverifikasi akses")
	}
	if member.Status != models.MemberActive {
		return utils.Error(c, http.StatusForbidden,
			"forbidden", "Keanggotaan workspace Anda tidak aktif")
	}

	conn, err := realtime.Upgrader.Upgrade(c.Response(), c.Request(), nil)
	if err != nil {
		return err // gorilla already wrote the response
	}

	realtime.NewClient(h.hub, conn, claims.UserID, workspaceID)

	// Mark agent online (broadcasts presence update).
	_ = h.presence.Set(context.Background(), claims.UserID, workspaceID, "online")
	return nil
}

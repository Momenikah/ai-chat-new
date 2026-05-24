package middleware

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/utils"
)

// WorkspaceMiddleware enforces workspace ownership and role.
//
// It is the core of Part 2's tenant isolation: every workspace-scoped
// request must pass through here, which verifies the caller is an active
// member of the workspace and meets the required role.
type WorkspaceMiddleware struct {
	members       *repositories.WorkspaceMemberRepository
	channels      *repositories.ChannelRepository
	conversations *repositories.ConversationRepository
	contacts      *repositories.ContactRepository
	apiKeys       *repositories.APIKeyRepository
	webhooks      *repositories.WebhookEndpointRepository
	workspaces    *repositories.WorkspaceRepository
}

// NewWorkspaceMiddleware constructs a WorkspaceMiddleware.
func NewWorkspaceMiddleware(
	members *repositories.WorkspaceMemberRepository,
	channels *repositories.ChannelRepository,
	conversations *repositories.ConversationRepository,
	contacts *repositories.ContactRepository,
	apiKeys *repositories.APIKeyRepository,
	webhooks *repositories.WebhookEndpointRepository,
	workspaces *repositories.WorkspaceRepository,
) *WorkspaceMiddleware {
	return &WorkspaceMiddleware{
		members: members, channels: channels,
		conversations: conversations, contacts: contacts,
		apiKeys: apiKeys, webhooks: webhooks, workspaces: workspaces,
	}
}

// RequireContactRole resolves the workspace via the `:id` contact path
// param, then applies the same membership/role check.
func (m *WorkspaceMiddleware) RequireContactRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			contactID := c.Param("id")
			if contactID == "" {
				return utils.Error(c, http.StatusBadRequest,
					"bad_request", "Contact id tidak ditemukan")
			}
			contact, err := m.contacts.GetByID(c.Request().Context(), contactID)
			if err != nil {
				if errors.Is(err, repositories.ErrNotFound) {
					return utils.Error(c, http.StatusNotFound,
						"not_found", "Kontak tidak ditemukan")
				}
				return utils.Error(c, http.StatusInternalServerError,
					"internal_error", "Gagal memuat kontak")
			}
			if err := m.authorize(c, contact.WorkspaceID, minimum); err != nil {
				return err
			}
			c.Set(ContextKeyContactID, contact.ID)
			return next(c)
		}
	}
}

// RequireConversationRole resolves the workspace via the `:id` conversation
// path param, then applies the same membership/role check.
func (m *WorkspaceMiddleware) RequireConversationRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			conversationID := c.Param("id")
			if conversationID == "" {
				return utils.Error(c, http.StatusBadRequest,
					"bad_request", "Conversation id tidak ditemukan")
			}

			conv, err := m.conversations.GetByID(c.Request().Context(), conversationID)
			if err != nil {
				if errors.Is(err, repositories.ErrNotFound) {
					return utils.Error(c, http.StatusNotFound,
						"not_found", "Percakapan tidak ditemukan")
				}
				return utils.Error(c, http.StatusInternalServerError,
					"internal_error", "Gagal memuat percakapan")
			}

			if err := m.authorize(c, conv.WorkspaceID, minimum); err != nil {
				return err
			}
			c.Set(ContextKeyConversationID, conv.ID)
			return next(c)
		}
	}
}

// RequireWorkspaceRole resolves the workspace from the `:id` path param,
// verifies the caller is an active member with at least `minimum` role,
// and stores the workspace id + role in the context. Chain after RequireAuth.
func (m *WorkspaceMiddleware) RequireWorkspaceRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			workspaceID := c.Param("id")
			if workspaceID == "" {
				return utils.Error(c, http.StatusBadRequest,
					"bad_request", "Workspace id tidak ditemukan")
			}
			if err := m.authorize(c, workspaceID, minimum); err != nil {
				return err
			}
			return next(c)
		}
	}
}

// RequireChannelRole resolves the workspace via the `:id` channel path
// param, then applies the same membership/role check.
func (m *WorkspaceMiddleware) RequireChannelRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			channelID := c.Param("id")
			if channelID == "" {
				return utils.Error(c, http.StatusBadRequest,
					"bad_request", "Channel id tidak ditemukan")
			}

			channel, err := m.channels.GetByID(c.Request().Context(), channelID)
			if err != nil {
				if errors.Is(err, repositories.ErrNotFound) {
					return utils.Error(c, http.StatusNotFound,
						"not_found", "Channel tidak ditemukan")
				}
				return utils.Error(c, http.StatusInternalServerError,
					"internal_error", "Gagal memuat channel")
			}

			if err := m.authorize(c, channel.WorkspaceID, minimum); err != nil {
				return err
			}
			c.Set(ContextKeyChannelID, channel.ID)
			return next(c)
		}
	}
}

// RequireAPIKeyRole resolves the workspace via the `:id` api-key path
// param, then applies the membership/role check. Used by the resource-
// scoped key management routes (e.g. DELETE /api-keys/:id).
func (m *WorkspaceMiddleware) RequireAPIKeyRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			id := c.Param("id")
			if id == "" {
				return utils.Error(c, http.StatusBadRequest, "bad_request", "API key id tidak ditemukan")
			}
			key, err := m.apiKeys.GetByID(c.Request().Context(), id)
			if err != nil {
				if errors.Is(err, repositories.ErrNotFound) {
					return utils.Error(c, http.StatusNotFound, "not_found", "API key tidak ditemukan")
				}
				return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat API key")
			}
			if err := m.authorize(c, key.WorkspaceID, minimum); err != nil {
				return err
			}
			return next(c)
		}
	}
}

// RequireWebhookRole resolves the workspace via the `:id` webhook-endpoint
// path param, then applies the membership/role check.
func (m *WorkspaceMiddleware) RequireWebhookRole(minimum models.MemberRole) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			id := c.Param("id")
			if id == "" {
				return utils.Error(c, http.StatusBadRequest, "bad_request", "Webhook id tidak ditemukan")
			}
			ep, err := m.webhooks.GetByID(c.Request().Context(), id)
			if err != nil {
				if errors.Is(err, repositories.ErrNotFound) {
					return utils.Error(c, http.StatusNotFound, "not_found", "Webhook tidak ditemukan")
				}
				return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat webhook")
			}
			if err := m.authorize(c, ep.WorkspaceID, minimum); err != nil {
				return err
			}
			return next(c)
		}
	}
}

// authorize performs the membership + role check shared by both guards.
func (m *WorkspaceMiddleware) authorize(c echo.Context, workspaceID string, minimum models.MemberRole) error {
	member, err := m.members.Get(c.Request().Context(), workspaceID, UserID(c))
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			// 404 (not 403) so we never confirm a workspace the caller
			// has no relationship with even exists.
			return utils.Error(c, http.StatusNotFound,
				"not_found", "Workspace tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memverifikasi akses workspace")
	}

	if member.Status != models.MemberActive {
		return utils.Error(c, http.StatusForbidden,
			"forbidden", "Keanggotaan workspace Anda tidak aktif")
	}
	if !member.Role.AtLeast(minimum) {
		return utils.Error(c, http.StatusForbidden,
			"forbidden", "Role Anda tidak cukup untuk aksi ini")
	}

	// Suspended workspaces are frozen for everyone (set by a super admin).
	if m.workspaces != nil {
		if ws, err := m.workspaces.GetByID(c.Request().Context(), workspaceID); err == nil && ws.IsSuspended() {
			return utils.Error(c, http.StatusForbidden,
				"workspace_suspended", "Workspace ini sedang ditangguhkan. Hubungi dukungan.")
		}
	}

	c.Set(ContextKeyWorkspaceID, workspaceID)
	c.Set(ContextKeyMemberRole, string(member.Role))
	return nil
}

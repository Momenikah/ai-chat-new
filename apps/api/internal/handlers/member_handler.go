package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// MemberHandler exposes team-member management endpoints.
type MemberHandler struct {
	members *services.MemberService
}

// NewMemberHandler constructs a MemberHandler.
func NewMemberHandler(members *services.MemberService) *MemberHandler {
	return &MemberHandler{members: members}
}

type inviteRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required,oneof=ADMIN AGENT VIEWER"`
}

// List handles GET /workspaces/:id/members.
func (h *MemberHandler) List(c echo.Context) error {
	listing, err := h.members.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat anggota tim")
	}
	return utils.OK(c, listing)
}

// Invite handles POST /workspaces/:id/invite.
func (h *MemberHandler) Invite(c echo.Context) error {
	var req inviteRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	result, err := h.members.Invite(
		c.Request().Context(),
		middleware.WorkspaceID(c),
		middleware.UserID(c),
		req.Email,
		models.MemberRole(req.Role),
	)
	if err != nil {
		if resp, handled := handlePlanError(c, err); handled {
			return resp
		}
		switch {
		case errors.Is(err, services.ErrAlreadyMember):
			return utils.Error(c, http.StatusConflict,
				"already_member", "Pengguna sudah menjadi anggota workspace")
		case errors.Is(err, services.ErrInvitationExists):
			return utils.Error(c, http.StatusConflict,
				"invitation_exists", "Undangan untuk email ini masih menunggu")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal mengirim undangan")
		}
	}
	return utils.Created(c, result)
}

// Remove handles DELETE /workspaces/:id/members/:memberId.
func (h *MemberHandler) Remove(c echo.Context) error {
	memberID := c.Param("memberId")

	err := h.members.RemoveMember(c.Request().Context(), middleware.WorkspaceID(c), memberID)
	if err != nil {
		switch {
		case errors.Is(err, services.ErrMemberNotFound):
			return utils.Error(c, http.StatusNotFound,
				"not_found", "Anggota tidak ditemukan")
		case errors.Is(err, services.ErrCannotRemoveOwner):
			return utils.Error(c, http.StatusForbidden,
				"cannot_remove_owner", "Pemilik workspace tidak dapat dihapus")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal menghapus anggota")
		}
	}
	return c.NoContent(http.StatusNoContent)
}

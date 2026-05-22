package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// ChannelHandler exposes channel management endpoints.
type ChannelHandler struct {
	channels *services.ChannelService
}

// NewChannelHandler constructs a ChannelHandler.
func NewChannelHandler(channels *services.ChannelService) *ChannelHandler {
	return &ChannelHandler{channels: channels}
}

type createChannelRequest struct {
	Type        string         `json:"type" validate:"required,oneof=whatsapp instagram messenger"`
	Name        string         `json:"name" validate:"required,min=2,max=80"`
	ExternalID  *string        `json:"external_id" validate:"omitempty,max=120"`
	Credentials map[string]any `json:"credentials"`
}

type updateChannelRequest struct {
	Name        *string        `json:"name" validate:"omitempty,min=2,max=80"`
	Status      *string        `json:"status" validate:"omitempty,oneof=disconnected pending connected error"`
	ExternalID  *string        `json:"external_id" validate:"omitempty,max=120"`
	Credentials map[string]any `json:"credentials"`
}

// List handles GET /workspaces/:id/channels.
func (h *ChannelHandler) List(c echo.Context) error {
	list, err := h.channels.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat channel")
	}
	return utils.OK(c, map[string]any{"channels": list})
}

// Create handles POST /workspaces/:id/channels.
func (h *ChannelHandler) Create(c echo.Context) error {
	var req createChannelRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	channel, err := h.channels.Create(c.Request().Context(), middleware.WorkspaceID(c),
		services.CreateChannelInput{
			Type:        req.Type,
			Name:        req.Name,
			ExternalID:  req.ExternalID,
			Credentials: req.Credentials,
		})
	if err != nil {
		if errors.Is(err, services.ErrInvalidChannelType) {
			return utils.Error(c, http.StatusUnprocessableEntity,
				"invalid_type", "Tipe channel tidak valid")
		}
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal menambahkan channel")
	}
	return utils.Created(c, channel)
}

// Update handles PATCH /channels/:id.
func (h *ChannelHandler) Update(c echo.Context) error {
	var req updateChannelRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	channel, err := h.channels.Update(c.Request().Context(), middleware.ChannelID(c),
		services.UpdateChannelInput{
			Name:        req.Name,
			Status:      req.Status,
			ExternalID:  req.ExternalID,
			Credentials: req.Credentials,
		})
	if err != nil {
		switch {
		case errors.Is(err, repositories.ErrNotFound):
			return utils.Error(c, http.StatusNotFound, "not_found", "Channel tidak ditemukan")
		case errors.Is(err, services.ErrInvalidChannelStatus):
			return utils.Error(c, http.StatusUnprocessableEntity,
				"invalid_status", "Status channel tidak valid")
		default:
			return utils.Error(c, http.StatusInternalServerError,
				"internal_error", "Gagal memperbarui channel")
		}
	}
	return utils.OK(c, channel)
}

// Delete handles DELETE /channels/:id.
func (h *ChannelHandler) Delete(c echo.Context) error {
	if err := h.channels.Delete(c.Request().Context(), middleware.ChannelID(c)); err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal menghapus channel")
	}
	return c.NoContent(http.StatusNoContent)
}

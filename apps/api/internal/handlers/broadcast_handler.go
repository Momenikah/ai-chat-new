package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// BroadcastHandler exposes the broadcast-campaign endpoints.
type BroadcastHandler struct {
	broadcasts *services.BroadcastService
}

// NewBroadcastHandler constructs a BroadcastHandler.
func NewBroadcastHandler(s *services.BroadcastService) *BroadcastHandler {
	return &BroadcastHandler{broadcasts: s}
}

type createBroadcastRequest struct {
	Name           string          `json:"name" validate:"required,min=2,max=120"`
	ChannelID      string          `json:"channel_id" validate:"required,uuid"`
	TemplateID     *string         `json:"template_id" validate:"omitempty,uuid"`
	AudienceKind   string          `json:"audience_kind" validate:"required,oneof=all tag segment csv"`
	AudienceFilter json.RawMessage `json:"audience_filter"`
	BodyOverride   *string         `json:"body_override" validate:"omitempty,max=4000"`
	Variables      json.RawMessage `json:"variables"`
	RatePerMinute  int             `json:"rate_per_minute" validate:"omitempty,min=1,max=600"`
}

type scheduleRequest struct {
	ScheduledAt time.Time `json:"scheduled_at" validate:"required"`
	Launch      bool      `json:"launch"`
}

// List handles GET /workspaces/:id/broadcasts.
func (h *BroadcastHandler) List(c echo.Context) error {
	list, err := h.broadcasts.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat broadcast")
	}
	return utils.OK(c, map[string]any{"broadcasts": list})
}

// Create handles POST /workspaces/:id/broadcasts.
func (h *BroadcastHandler) Create(c echo.Context) error {
	var req createBroadcastRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	camp, err := h.broadcasts.Create(c.Request().Context(), services.CreateBroadcastInput{
		WorkspaceID:    middleware.WorkspaceID(c),
		ActorID:        middleware.UserID(c),
		ChannelID:      req.ChannelID,
		TemplateID:     req.TemplateID,
		Name:           req.Name,
		AudienceKind:   req.AudienceKind,
		AudienceFilter: req.AudienceFilter,
		BodyOverride:   req.BodyOverride,
		Variables:      req.Variables,
		RatePerMinute:  req.RatePerMinute,
	})
	if err != nil {
		return mapBroadcastError(c, err)
	}
	return utils.Created(c, camp)
}

// Get handles GET /workspaces/:id/broadcasts/:campaignId.
func (h *BroadcastHandler) Get(c echo.Context) error {
	id := c.Param("campaignId")
	detail, err := h.broadcasts.Get(c.Request().Context(), id)
	if err != nil {
		return mapBroadcastError(c, err)
	}
	if detail.Campaign.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Campaign tidak ditemukan")
	}
	return utils.OK(c, detail)
}

// Schedule handles POST /workspaces/:id/broadcasts/:campaignId/schedule.
// When `launch=true`, the campaign is launched immediately (used for
// instant-send + as a shortcut from the UI).
func (h *BroadcastHandler) Schedule(c echo.Context) error {
	var req scheduleRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	id := c.Param("campaignId")
	if !h.ownsCampaign(c, id) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Campaign tidak ditemukan")
	}
	if req.Launch || req.ScheduledAt.Before(time.Now().Add(5*time.Second)) {
		out, err := h.broadcasts.Launch(c.Request().Context(), id)
		if err != nil {
			return mapBroadcastError(c, err)
		}
		return utils.OK(c, out)
	}
	out, err := h.broadcasts.Schedule(c.Request().Context(), id, req.ScheduledAt)
	if err != nil {
		return mapBroadcastError(c, err)
	}
	return utils.OK(c, out)
}

// Cancel handles POST /workspaces/:id/broadcasts/:campaignId/cancel.
func (h *BroadcastHandler) Cancel(c echo.Context) error {
	id := c.Param("campaignId")
	if !h.ownsCampaign(c, id) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Campaign tidak ditemukan")
	}
	out, err := h.broadcasts.Cancel(c.Request().Context(), id)
	if err != nil {
		return mapBroadcastError(c, err)
	}
	return utils.OK(c, out)
}

func (h *BroadcastHandler) ownsCampaign(c echo.Context, id string) bool {
	d, err := h.broadcasts.Get(c.Request().Context(), id)
	if err != nil {
		return false
	}
	return d.Campaign.WorkspaceID == middleware.WorkspaceID(c)
}

func mapBroadcastError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrCampaignNotFound):
		return utils.Error(c, http.StatusNotFound, "not_found", "Campaign tidak ditemukan")
	case errors.Is(err, services.ErrCampaignNotLaunchable):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_status", "Status campaign tidak valid untuk aksi ini")
	case errors.Is(err, services.ErrEmptyAudience):
		return utils.Error(c, http.StatusUnprocessableEntity, "empty_audience", "Audience kosong")
	case errors.Is(err, services.ErrInvalidAudienceKind):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_audience", "Jenis audience tidak valid")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses campaign")
}

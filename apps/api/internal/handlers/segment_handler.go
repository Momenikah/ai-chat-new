package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// SegmentHandler exposes segment endpoints.
type SegmentHandler struct {
	segments *services.SegmentService
}

// NewSegmentHandler constructs a SegmentHandler.
func NewSegmentHandler(s *services.SegmentService) *SegmentHandler {
	return &SegmentHandler{segments: s}
}

type segmentRuleInput struct {
	Field    string `json:"field" validate:"required,oneof=name phone email location company channel tag"`
	Operator string `json:"operator" validate:"required,oneof=equals contains"`
	Value    string `json:"value" validate:"required,max=200"`
}

type createSegmentRequest struct {
	Name        string             `json:"name" validate:"required,min=1,max=80"`
	Description *string            `json:"description" validate:"omitempty,max=400"`
	Color       string             `json:"color" validate:"omitempty,hexcolor"`
	Rules       []segmentRuleInput `json:"rules" validate:"max=10,dive"`
}

// List handles GET /workspaces/:id/segments.
func (h *SegmentHandler) List(c echo.Context) error {
	list, err := h.segments.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError,
			"internal_error", "Gagal memuat segment")
	}
	return utils.OK(c, map[string]any{"segments": list})
}

// Create handles POST /workspaces/:id/segments.
func (h *SegmentHandler) Create(c echo.Context) error {
	var req createSegmentRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}

	rules := make([]services.SegmentRuleInput, 0, len(req.Rules))
	for _, r := range req.Rules {
		rules = append(rules, services.SegmentRuleInput{
			Field: r.Field, Operator: r.Operator, Value: r.Value,
		})
	}

	seg, err := h.segments.Create(c.Request().Context(), services.CreateSegmentInput{
		WorkspaceID: middleware.WorkspaceID(c),
		ActorID:     middleware.UserID(c),
		Name:        req.Name,
		Description: req.Description,
		Color:       req.Color,
		Rules:       rules,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrInvalidRuleField):
			return utils.Error(c, http.StatusUnprocessableEntity, "invalid_field", "Field rule tidak valid")
		case errors.Is(err, services.ErrInvalidRuleOp):
			return utils.Error(c, http.StatusUnprocessableEntity, "invalid_op", "Operator rule tidak valid")
		default:
			return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal membuat segment")
		}
	}
	return utils.Created(c, seg)
}

// Get handles GET /workspaces/:id/segments/:segmentId.
// Returns the segment, its rules and its current member list.
func (h *SegmentHandler) Get(c echo.Context) error {
	segmentID := c.Param("segmentId")
	seg, members, err := h.segments.Get(c.Request().Context(), segmentID)
	if err != nil {
		if errors.Is(err, services.ErrSegmentNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Segment tidak ditemukan")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat segment")
	}
	if seg.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Segment tidak ditemukan")
	}
	return utils.OK(c, map[string]any{
		"segment": seg,
		"members": members,
	})
}

// Delete handles DELETE /workspaces/:id/segments/:segmentId.
func (h *SegmentHandler) Delete(c echo.Context) error {
	segmentID := c.Param("segmentId")
	if err := h.segments.Delete(c.Request().Context(), segmentID, middleware.WorkspaceID(c)); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus segment")
	}
	return c.NoContent(http.StatusNoContent)
}

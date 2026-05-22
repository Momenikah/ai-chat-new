package handlers

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// TemplateHandler exposes message-template endpoints.
type TemplateHandler struct {
	templates *services.TemplateService
}

// NewTemplateHandler constructs a TemplateHandler.
func NewTemplateHandler(s *services.TemplateService) *TemplateHandler {
	return &TemplateHandler{templates: s}
}

type templateVariableInput struct {
	Name        string  `json:"name" validate:"required,max=50"`
	Label       *string `json:"label" validate:"omitempty,max=80"`
	SampleValue *string `json:"sample_value" validate:"omitempty,max=200"`
}

type createTemplateRequest struct {
	Name          string                  `json:"name" validate:"required,min=2,max=80"`
	Category      string                  `json:"category" validate:"required,oneof=marketing utility authentication"`
	Language      string                  `json:"language" validate:"omitempty,max=10"`
	HeaderKind    *string                 `json:"header_kind" validate:"omitempty,oneof=text image video document"`
	HeaderContent *string                 `json:"header_content" validate:"omitempty,max=500"`
	Body          string                  `json:"body" validate:"required,max=4000"`
	Footer        *string                 `json:"footer" validate:"omitempty,max=200"`
	Buttons       json.RawMessage         `json:"buttons"`
	Variables     []templateVariableInput `json:"variables" validate:"max=20,dive"`
}

type useTemplateRequest struct {
	ConversationID *string           `json:"conversation_id" validate:"omitempty,uuid"`
	Variables      map[string]string `json:"variables"`
}

// List handles GET /workspaces/:id/templates.
func (h *TemplateHandler) List(c echo.Context) error {
	list, err := h.templates.List(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat template")
	}
	return utils.OK(c, map[string]any{"templates": list})
}

// Create handles POST /workspaces/:id/templates.
func (h *TemplateHandler) Create(c echo.Context) error {
	var req createTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	t, err := h.templates.Create(c.Request().Context(), services.CreateTemplateInput{
		WorkspaceID:   middleware.WorkspaceID(c),
		ActorID:       middleware.UserID(c),
		Name:          req.Name,
		Category:      req.Category,
		Language:      req.Language,
		HeaderKind:    req.HeaderKind,
		HeaderContent: req.HeaderContent,
		Body:          req.Body,
		Footer:        req.Footer,
		Buttons:       req.Buttons,
		Variables:     templateVarsFromRequest(req.Variables),
	})
	if err != nil {
		return mapTemplateError(c, err)
	}
	return utils.Created(c, t)
}

// Get handles GET /workspaces/:id/templates/:templateId.
func (h *TemplateHandler) Get(c echo.Context) error {
	id := c.Param("templateId")
	t, err := h.templates.Get(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	if t.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	return utils.OK(c, t)
}

// Update handles PATCH /workspaces/:id/templates/:templateId.
func (h *TemplateHandler) Update(c echo.Context) error {
	var req createTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	id := c.Param("templateId")
	current, err := h.templates.Get(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	if current.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	t, err := h.templates.Update(c.Request().Context(), services.UpdateTemplateInput{
		ID:            id,
		Name:          req.Name,
		Category:      req.Category,
		Language:      req.Language,
		HeaderKind:    req.HeaderKind,
		HeaderContent: req.HeaderContent,
		Body:          req.Body,
		Footer:        req.Footer,
		Buttons:       req.Buttons,
		Variables:     templateVarsFromRequest(req.Variables),
	})
	if err != nil {
		return mapTemplateError(c, err)
	}
	return utils.OK(c, t)
}

// Delete handles DELETE /workspaces/:id/templates/:templateId.
func (h *TemplateHandler) Delete(c echo.Context) error {
	id := c.Param("templateId")
	current, err := h.templates.Get(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	if current.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	if err := h.templates.Delete(c.Request().Context(), id); err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menghapus template")
	}
	return c.NoContent(http.StatusNoContent)
}

// Submit handles POST /workspaces/:id/templates/:templateId/submit.
func (h *TemplateHandler) Submit(c echo.Context) error {
	id := c.Param("templateId")
	current, err := h.templates.Get(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	if current.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	out, err := h.templates.Submit(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	return utils.OK(c, out)
}

// Use handles POST /workspaces/:id/templates/:templateId/use.
func (h *TemplateHandler) Use(c echo.Context) error {
	var req useTemplateRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	id := c.Param("templateId")
	current, err := h.templates.Get(c.Request().Context(), id)
	if err != nil {
		return mapTemplateError(c, err)
	}
	if current.WorkspaceID != middleware.WorkspaceID(c) {
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	}
	out, err := h.templates.Use(c.Request().Context(), services.UseTemplateInput{
		TemplateID:     id,
		WorkspaceID:    middleware.WorkspaceID(c),
		ActorID:        middleware.UserID(c),
		ConversationID: req.ConversationID,
		Variables:      req.Variables,
	})
	if err != nil {
		return mapTemplateError(c, err)
	}
	return utils.OK(c, out)
}

func templateVarsFromRequest(in []templateVariableInput) []services.TemplateVariableInput {
	out := make([]services.TemplateVariableInput, 0, len(in))
	for _, v := range in {
		out = append(out, services.TemplateVariableInput{
			Name:        v.Name,
			Label:       v.Label,
			SampleValue: v.SampleValue,
		})
	}
	return out
}

func mapTemplateError(c echo.Context, err error) error {
	switch {
	case errors.Is(err, services.ErrTemplateNotFound):
		return utils.Error(c, http.StatusNotFound, "not_found", "Template tidak ditemukan")
	case errors.Is(err, services.ErrTemplateLocked):
		return utils.Error(c, http.StatusForbidden, "locked", "Template terkunci (pending/approved)")
	case errors.Is(err, services.ErrInvalidCategory):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_category", "Kategori template tidak valid")
	case errors.Is(err, services.ErrInvalidStatusFlow):
		return utils.Error(c, http.StatusUnprocessableEntity, "invalid_status", "Transisi status tidak valid")
	case errors.Is(err, services.ErrEmptyTemplateBody):
		return utils.Error(c, http.StatusUnprocessableEntity, "empty_body", "Isi template tidak boleh kosong")
	}
	return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memproses template")
}

package handlers

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// AIAgentHandler exposes the per-workspace AI agent settings endpoints
// (GET/PATCH agent, approve/reject prompt, list reviews).
type AIAgentHandler struct {
	agents *services.AIAgentService
}

// NewAIAgentHandler constructs an AIAgentHandler.
func NewAIAgentHandler(s *services.AIAgentService) *AIAgentHandler {
	return &AIAgentHandler{agents: s}
}

type updateAIAgentRequest struct {
	Name                string   `json:"name" validate:"required,min=1,max=80"`
	Tone                string   `json:"tone" validate:"required,max=120"`
	Language            string   `json:"language" validate:"required,max=10"`
	SystemPrompt        string   `json:"system_prompt" validate:"required,max=4000"`
	FallbackMessage     string   `json:"fallback_message" validate:"required,max=500"`
	ConfidenceThreshold float32  `json:"confidence_threshold" validate:"min=0,max=1"`
	Enabled             bool     `json:"enabled"`
	EnabledChannelIDs   []string `json:"enabled_channel_ids" validate:"dive,uuid"`
	HandoffEnabled      bool     `json:"handoff_enabled"`
	Model               string   `json:"model" validate:"max=80"`
	EmbeddingModel      string   `json:"embedding_model" validate:"max=80"`
}

type reviewRequest struct {
	Notes *string `json:"notes" validate:"omitempty,max=500"`
}

// Get handles GET /workspaces/:id/ai-agent.
func (h *AIAgentHandler) Get(c echo.Context) error {
	agent, err := h.agents.Get(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat agent")
	}
	return utils.OK(c, agent)
}

// Update handles PATCH /workspaces/:id/ai-agent. Always resets
// prompt_approved → false (a fresh review is required).
func (h *AIAgentHandler) Update(c echo.Context) error {
	var req updateAIAgentRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	agent, err := h.agents.Save(c.Request().Context(), services.AIAgentInput{
		WorkspaceID:         middleware.WorkspaceID(c),
		Name:                req.Name,
		Tone:                req.Tone,
		Language:            req.Language,
		SystemPrompt:        req.SystemPrompt,
		FallbackMessage:     req.FallbackMessage,
		ConfidenceThreshold: req.ConfidenceThreshold,
		Enabled:             req.Enabled,
		EnabledChannelIDs:   req.EnabledChannelIDs,
		HandoffEnabled:      req.HandoffEnabled,
		Model:               req.Model,
		EmbeddingModel:      req.EmbeddingModel,
	})
	if err != nil {
		if resp, handled := handlePlanError(c, err); handled {
			return resp
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menyimpan agent")
	}
	return utils.OK(c, agent)
}

// Approve handles POST /workspaces/:id/ai-agent/approve.
func (h *AIAgentHandler) Approve(c echo.Context) error {
	var req reviewRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	agent, err := h.agents.Approve(c.Request().Context(),
		middleware.WorkspaceID(c), middleware.UserID(c), req.Notes)
	if err != nil {
		if errors.Is(err, services.ErrAIAgentNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Agent belum dibuat")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menyetujui prompt")
	}
	return utils.OK(c, agent)
}

// Reject handles POST /workspaces/:id/ai-agent/reject.
func (h *AIAgentHandler) Reject(c echo.Context) error {
	var req reviewRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	if err := h.agents.Reject(c.Request().Context(),
		middleware.WorkspaceID(c), middleware.UserID(c), req.Notes); err != nil {
		if errors.Is(err, services.ErrAIAgentNotFound) {
			return utils.Error(c, http.StatusNotFound, "not_found", "Agent belum dibuat")
		}
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menolak prompt")
	}
	return c.NoContent(http.StatusNoContent)
}

// Reviews handles GET /workspaces/:id/ai-agent/reviews.
func (h *AIAgentHandler) Reviews(c echo.Context) error {
	list, err := h.agents.ListReviews(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat reviews")
	}
	return utils.OK(c, map[string]any{"reviews": list})
}

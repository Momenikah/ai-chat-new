package handlers

import (
	"net/http"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/middleware"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/services"
	"github.com/aichat/api/internal/utils"
)

// AIHandler exposes the playground + bot reply log endpoints.
type AIHandler struct {
	reply *services.AIReplyService
	logs  *repositories.AIRepository
}

// NewAIHandler constructs an AIHandler.
func NewAIHandler(reply *services.AIReplyService, logs *repositories.AIRepository) *AIHandler {
	return &AIHandler{reply: reply, logs: logs}
}

type playgroundRequest struct {
	Message      string `json:"message" validate:"required,min=1,max=4000"`
	SystemPrompt string `json:"system_prompt" validate:"omitempty,max=4000"`
}

// Playground handles POST /workspaces/:id/ai/playground. Runs the same
// retrieval + LLM pipeline as production but writes nothing.
func (h *AIHandler) Playground(c echo.Context) error {
	var req playgroundRequest
	if err := bindAndValidate(c, &req); err != nil {
		return err
	}
	result, err := h.reply.Playground(c.Request().Context(), services.PlaygroundInput{
		WorkspaceID:  middleware.WorkspaceID(c),
		Message:      req.Message,
		SystemPrompt: req.SystemPrompt,
	})
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal menjalankan playground")
	}
	return utils.OK(c, result)
}

// Logs handles GET /workspaces/:id/ai/logs. Returns recent auto-reply
// attempts (success + failures).
func (h *AIHandler) Logs(c echo.Context) error {
	list, err := h.logs.ListBotReplyLogs(c.Request().Context(), middleware.WorkspaceID(c))
	if err != nil {
		return utils.Error(c, http.StatusInternalServerError, "internal_error", "Gagal memuat log")
	}
	return utils.OK(c, map[string]any{"logs": list})
}

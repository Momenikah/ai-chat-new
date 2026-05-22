package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// ErrAIAgentNotFound is returned for missing agent rows.
var ErrAIAgentNotFound = errors.New("ai agent not found")

// AIAgentService implements per-workspace AI agent CRUD + prompt review.
type AIAgentService struct {
	ai   *repositories.AIRepository
	plan PlanEnforcer
}

// NewAIAgentService constructs an AIAgentService.
func NewAIAgentService(repo *repositories.AIRepository) *AIAgentService {
	return &AIAgentService{ai: repo}
}

// SetPlanEnforcer wires plan-limit enforcement. Optional (nil = no limits).
func (s *AIAgentService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// AIAgentInput is the payload from the settings page.
type AIAgentInput struct {
	WorkspaceID         string
	Name                string
	Tone                string
	Language            string
	SystemPrompt        string
	FallbackMessage     string
	ConfidenceThreshold float32
	Enabled             bool
	EnabledChannelIDs   []string
	HandoffEnabled      bool
	Model               string
	EmbeddingModel      string
}

// Get returns or lazily creates the workspace's agent.
func (s *AIAgentService) Get(ctx context.Context, workspaceID string) (*models.AIAgent, error) {
	agent, err := s.ai.GetAIAgentByWorkspace(ctx, workspaceID)
	if err == nil {
		return agent, nil
	}
	if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	// Initial default agent — disabled until the operator approves a prompt.
	return s.ai.UpsertAIAgent(ctx, repositories.UpsertAIAgentParams{
		WorkspaceID:         workspaceID,
		Name:                "Asisten AI",
		Tone:                "profesional dan ramah",
		Language:            "id",
		SystemPrompt:        defaultSystemPrompt(),
		FallbackMessage:     "Maaf, saya akan menghubungkan Anda dengan tim kami.",
		ConfidenceThreshold: 0.6,
		Enabled:             false,
		HandoffEnabled:      true,
		Model:               "gpt-4o-mini",
		EmbeddingModel:      "text-embedding-3-small",
	})
}

// Save upserts the agent. Saving always resets prompt_approved to false
// (operator must explicitly re-approve before the bot replies). Enabling
// the bot requires the AI Chatbot feature on the workspace's plan.
func (s *AIAgentService) Save(ctx context.Context, in AIAgentInput) (*models.AIAgent, error) {
	if in.Enabled {
		if err := ensureFeature(s.plan, ctx, in.WorkspaceID, FeatureAIChatbot); err != nil {
			return nil, err
		}
	}
	channelIDs, _ := json.Marshal(in.EnabledChannelIDs)
	return s.ai.UpsertAIAgent(ctx, repositories.UpsertAIAgentParams{
		WorkspaceID:         in.WorkspaceID,
		Name:                in.Name,
		Tone:                in.Tone,
		Language:            in.Language,
		SystemPrompt:        in.SystemPrompt,
		FallbackMessage:     in.FallbackMessage,
		ConfidenceThreshold: in.ConfidenceThreshold,
		Enabled:             in.Enabled,
		EnabledChannelIDs:   channelIDs,
		HandoffEnabled:      in.HandoffEnabled,
		Model:               in.Model,
		EmbeddingModel:      in.EmbeddingModel,
	})
}

// Approve marks the current prompt as approved and records a review row.
func (s *AIAgentService) Approve(ctx context.Context, workspaceID, reviewerID string, notes *string) (*models.AIAgent, error) {
	agent, err := s.ai.GetAIAgentByWorkspace(ctx, workspaceID)
	if err != nil {
		return nil, ErrAIAgentNotFound
	}
	if _, err := s.ai.CreatePromptReview(ctx, agent.ID, workspaceID,
		agent.SystemPrompt, &reviewerID, models.PromptApproved, notes); err != nil {
		return nil, err
	}
	if err := s.ai.SetAIAgentApproved(ctx, workspaceID, true); err != nil {
		return nil, err
	}
	agent.PromptApproved = true
	return agent, nil
}

// Reject records a rejection review (keeps prompt_approved false).
func (s *AIAgentService) Reject(ctx context.Context, workspaceID, reviewerID string, notes *string) error {
	agent, err := s.ai.GetAIAgentByWorkspace(ctx, workspaceID)
	if err != nil {
		return ErrAIAgentNotFound
	}
	if _, err := s.ai.CreatePromptReview(ctx, agent.ID, workspaceID,
		agent.SystemPrompt, &reviewerID, models.PromptRejected, notes); err != nil {
		return err
	}
	return s.ai.SetAIAgentApproved(ctx, workspaceID, false)
}

// ListReviews returns the most recent reviews of an agent.
func (s *AIAgentService) ListReviews(ctx context.Context, workspaceID string) ([]models.AIPromptReview, error) {
	agent, err := s.ai.GetAIAgentByWorkspace(ctx, workspaceID)
	if err != nil {
		return []models.AIPromptReview{}, nil
	}
	return s.ai.ListPromptReviews(ctx, agent.ID)
}

func defaultSystemPrompt() string {
	return "Anda adalah asisten customer service yang ramah dan profesional. " +
		"Jawab dengan singkat, jelas, dan dalam Bahasa Indonesia. " +
		"Jika informasi tidak tersedia di knowledge base, akui dengan jujur dan " +
		"sarankan untuk menghubungi tim manusia."
}

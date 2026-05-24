package models

import (
	"encoding/json"
	"time"
)

// AIAgent is the per-workspace chatbot configuration.
type AIAgent struct {
	ID                  string          `json:"id"`
	WorkspaceID         string          `json:"workspace_id"`
	Name                string          `json:"name"`
	Tone                string          `json:"tone"`
	Language            string          `json:"language"`
	SystemPrompt        string          `json:"system_prompt"`
	FallbackMessage     string          `json:"fallback_message"`
	ConfidenceThreshold float32         `json:"confidence_threshold"`
	Enabled             bool            `json:"enabled"`
	EnabledChannelIDs   json.RawMessage `json:"enabled_channel_ids"`
	HandoffEnabled      bool            `json:"handoff_enabled"`
	Model               string          `json:"model"`
	EmbeddingModel      string          `json:"embedding_model"`
	PromptApproved      bool            `json:"prompt_approved"`
	CreatedAt           time.Time       `json:"created_at"`
	UpdatedAt           time.Time       `json:"updated_at"`
}

// KnowledgeSource enumerates the origin of a knowledge document.
type KnowledgeSource string

const (
	KnowledgeSourceUpload KnowledgeSource = "upload"
	KnowledgeSourceManual KnowledgeSource = "manual"
	KnowledgeSourceURL    KnowledgeSource = "url"
)

// KnowledgeStatus is the ingestion lifecycle of a knowledge document.
type KnowledgeStatus string

const (
	KnowledgeProcessing KnowledgeStatus = "processing"
	KnowledgeReady      KnowledgeStatus = "ready"
	KnowledgeFailed     KnowledgeStatus = "failed"
)

// KnowledgeDocument is one ingested doc (PDF/TXT/MD/manual article/URL).
type KnowledgeDocument struct {
	ID           string          `json:"id"`
	WorkspaceID  string          `json:"workspace_id"`
	Title        string          `json:"title"`
	SourceKind   KnowledgeSource `json:"source_kind"`
	SourceURL    *string         `json:"source_url"`
	MimeType     *string         `json:"mime_type"`
	RawContent   *string         `json:"raw_content,omitempty"`
	Status       KnowledgeStatus `json:"status"`
	ChunkCount   int             `json:"chunk_count"`
	ErrorMessage *string         `json:"error_message"`
	CreatedBy    *string         `json:"created_by"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// BotReplyLog is one audit row of an AI auto-reply attempt.
type BotReplyLog struct {
	ID               string          `json:"id"`
	WorkspaceID      string          `json:"workspace_id"`
	ConversationID   *string         `json:"conversation_id"`
	InboundMessageID *string         `json:"inbound_message_id"`
	ReplyMessageID   *string         `json:"reply_message_id"`
	InboundText      *string         `json:"inbound_text"`
	ResponseText     *string         `json:"response_text"`
	Confidence       float32         `json:"confidence"`
	HandedOff        bool            `json:"handed_off"`
	ChunkIDs         json.RawMessage `json:"chunk_ids"`
	Model            *string         `json:"model"`
	ErrorMessage     *string         `json:"error_message"`
	CreatedAt        time.Time       `json:"created_at"`
}

// PromptReviewStatus is the lifecycle of a prompt approval.
type PromptReviewStatus string

const (
	PromptPending  PromptReviewStatus = "pending"
	PromptApproved PromptReviewStatus = "approved"
	PromptRejected PromptReviewStatus = "rejected"
)

// AIPromptReview is a single revision/review of an agent's system prompt.
type AIPromptReview struct {
	ID          string             `json:"id"`
	AIAgentID   string             `json:"ai_agent_id"`
	WorkspaceID string             `json:"workspace_id"`
	Prompt      string             `json:"prompt"`
	ReviewerID  *string            `json:"reviewer_id"`
	Status      PromptReviewStatus `json:"status"`
	Notes       *string            `json:"notes"`
	CreatedAt   time.Time          `json:"created_at"`
	UpdatedAt   time.Time          `json:"updated_at"`
}

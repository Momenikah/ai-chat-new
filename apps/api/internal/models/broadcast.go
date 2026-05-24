package models

import (
	"encoding/json"
	"time"
)

// BroadcastStatus is the campaign lifecycle.
type BroadcastStatus string

const (
	BroadcastDraft     BroadcastStatus = "draft"
	BroadcastScheduled BroadcastStatus = "scheduled"
	BroadcastSending   BroadcastStatus = "sending"
	BroadcastCompleted BroadcastStatus = "completed"
	BroadcastFailed    BroadcastStatus = "failed"
	BroadcastCancelled BroadcastStatus = "cancelled"
)

// RecipientStatus mirrors the delivery state per recipient.
type RecipientStatus string

const (
	RecipientQueued    RecipientStatus = "queued"
	RecipientSent      RecipientStatus = "sent"
	RecipientDelivered RecipientStatus = "delivered"
	RecipientRead      RecipientStatus = "read"
	RecipientFailed    RecipientStatus = "failed"
	RecipientSkipped   RecipientStatus = "skipped"
)

// BroadcastCampaign is one campaign owned by a workspace.
type BroadcastCampaign struct {
	ID              string          `json:"id"`
	WorkspaceID     string          `json:"workspace_id"`
	ChannelID       string          `json:"channel_id"`
	TemplateID      *string         `json:"template_id"`
	Name            string          `json:"name"`
	AudienceKind    string          `json:"audience_kind"`
	AudienceFilter  json.RawMessage `json:"audience_filter"`
	BodyOverride    *string         `json:"body_override"`
	Variables       json.RawMessage `json:"variables"`
	Status          BroadcastStatus `json:"status"`
	RatePerMinute   int             `json:"rate_per_minute"`
	ScheduledAt     *time.Time      `json:"scheduled_at"`
	StartedAt       *time.Time      `json:"started_at"`
	CompletedAt     *time.Time      `json:"completed_at"`
	TotalRecipients int             `json:"total_recipients"`
	SentCount       int             `json:"sent_count"`
	DeliveredCount  int             `json:"delivered_count"`
	ReadCount       int             `json:"read_count"`
	FailedCount     int             `json:"failed_count"`
	ReplyCount      int             `json:"reply_count"`
	CreatedBy       *string         `json:"created_by"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// BroadcastRecipient is one recipient row.
type BroadcastRecipient struct {
	ID                string          `json:"id"`
	CampaignID        string          `json:"campaign_id"`
	WorkspaceID       string          `json:"workspace_id"`
	ContactID         *string         `json:"contact_id"`
	Name              *string         `json:"name"`
	Phone             *string         `json:"phone"`
	ExternalID        *string         `json:"external_id"`
	Variables         json.RawMessage `json:"variables"`
	RenderedBody      *string         `json:"rendered_body"`
	Status            RecipientStatus `json:"status"`
	MessageID         *string         `json:"message_id"`
	ExternalMessageID *string         `json:"external_message_id"`
	Attempts          int             `json:"attempts"`
	LastError         *string         `json:"last_error"`
	EnqueuedAt        *time.Time      `json:"enqueued_at"`
	SentAt            *time.Time      `json:"sent_at"`
	DeliveredAt       *time.Time      `json:"delivered_at"`
	ReadAt            *time.Time      `json:"read_at"`
	FailedAt          *time.Time      `json:"failed_at"`
	CreatedAt         time.Time       `json:"created_at"`
}

// BroadcastLog is one audit row.
type BroadcastLog struct {
	ID          string    `json:"id"`
	CampaignID  string    `json:"campaign_id"`
	RecipientID *string   `json:"recipient_id"`
	Event       string    `json:"event"`
	Detail      *string   `json:"detail"`
	OccurredAt  time.Time `json:"occurred_at"`
}

// MessageQueueRow is one outbox row for the worker queue.
type MessageQueueRow struct {
	ID           string          `json:"id"`
	WorkspaceID  string          `json:"workspace_id"`
	Kind         string          `json:"kind"`
	Payload      json.RawMessage `json:"payload"`
	Status       string          `json:"status"`
	Attempts     int             `json:"attempts"`
	ScheduledAt  *time.Time      `json:"scheduled_at"`
	StartedAt    *time.Time      `json:"started_at"`
	CompletedAt  *time.Time      `json:"completed_at"`
	Error        *string         `json:"error"`
	CreatedAt    time.Time       `json:"created_at"`
}

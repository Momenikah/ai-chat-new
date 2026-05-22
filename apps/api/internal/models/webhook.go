package models

import (
	"encoding/json"
	"time"
)

// WebhookLog is one row of the webhook_logs audit table.
type WebhookLog struct {
	ID           string          `json:"id"`
	WorkspaceID  *string         `json:"workspace_id"`
	ChannelID    *string         `json:"channel_id"`
	Provider     string          `json:"provider"`
	Direction    string          `json:"direction"`
	EventType    *string         `json:"event_type"`
	StatusCode   int             `json:"status_code"`
	Payload      json.RawMessage `json:"payload"`
	ErrorMessage *string         `json:"error_message"`
	ReceivedAt   time.Time       `json:"received_at"`
}

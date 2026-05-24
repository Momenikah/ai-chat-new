package models

import (
	"encoding/json"
	"time"
)

// InteractiveKind discriminates the JSON shape stored in `payload`.
const (
	InteractiveReplyButtons = "reply_buttons"
	InteractiveList         = "list"
	InteractiveCarousel     = "carousel"
)

// InteractiveMessage is a reusable interactive payload (reply-buttons /
// list selector / media carousel).
type InteractiveMessage struct {
	ID          string          `json:"id"`
	WorkspaceID string          `json:"workspace_id"`
	Name        string          `json:"name"`
	Kind        string          `json:"kind"`
	Payload     json.RawMessage `json:"payload"`
	CreatedBy   *string         `json:"created_by"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

// ValidInteractiveKind reports whether kind is a supported builder type.
func ValidInteractiveKind(kind string) bool {
	switch kind {
	case InteractiveReplyButtons, InteractiveList, InteractiveCarousel:
		return true
	}
	return false
}

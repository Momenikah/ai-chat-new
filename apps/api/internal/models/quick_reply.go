package models

import "time"

// QuickReply is a workspace-scoped canned response that an agent can
// insert via shortcut ("/greet", "/hours", …).
type QuickReply struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Shortcut    string    `json:"shortcut"`
	Body        string    `json:"body"`
	CreatedBy   *string   `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

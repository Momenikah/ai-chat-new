package models

import "time"

// AgentPresence reports an agent's online status within a workspace.
type AgentPresence struct {
	UserID      string    `json:"user_id"`
	WorkspaceID string    `json:"workspace_id"`
	Status      string    `json:"status"`
	LastSeenAt  time.Time `json:"last_seen_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	UserName    string    `json:"user_name"`
	UserEmail   string    `json:"user_email"`
}

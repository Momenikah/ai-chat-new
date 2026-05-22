package models

import (
	"encoding/json"
	"time"
)

// Contact is the external customer on the other side of a conversation.
type Contact struct {
	ID             string          `json:"id"`
	WorkspaceID    string          `json:"workspace_id"`
	Name           string          `json:"name"`
	Phone          *string         `json:"phone"`
	Email          *string         `json:"email"`
	AvatarURL      *string         `json:"avatar_url"`
	ExternalSource *ChannelType    `json:"external_source"`
	ExternalID     *string         `json:"external_id"`
	Metadata       json.RawMessage `json:"metadata"`
	Location       *string         `json:"location"`
	Company        *string         `json:"company"`
	Birthday       *time.Time      `json:"birthday"`
	Notes          *string         `json:"notes"`
	LastSeenAt     *time.Time      `json:"last_seen_at"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

// Tag is a workspace-scoped label that can be attached to contacts.
type Tag struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Color       string    `json:"color"`
	CreatedAt   time.Time `json:"created_at"`
}

// ContactWithTags is a contact plus its tag list.
type ContactWithTags struct {
	Contact
	Tags []Tag `json:"tags"`
}

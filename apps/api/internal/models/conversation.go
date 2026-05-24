package models

import "time"

// ConversationStatus is the lifecycle state of a conversation.
type ConversationStatus string

const (
	ConvOpen     ConversationStatus = "open"
	ConvPending  ConversationStatus = "pending"
	ConvResolved ConversationStatus = "resolved"
	ConvSpam     ConversationStatus = "spam"
)

// Valid reports whether s is a known conversation status.
func (s ConversationStatus) Valid() bool {
	switch s {
	case ConvOpen, ConvPending, ConvResolved, ConvSpam:
		return true
	default:
		return false
	}
}

// Conversation is a thread of messages with a contact on a single channel.
type Conversation struct {
	ID                 string             `json:"id"`
	WorkspaceID        string             `json:"workspace_id"`
	ChannelID          string             `json:"channel_id"`
	ContactID          string             `json:"contact_id"`
	Status             ConversationStatus `json:"status"`
	AssignedAgentID    *string            `json:"assigned_agent_id"`
	LastMessageAt      *time.Time         `json:"last_message_at"`
	LastMessagePreview *string            `json:"last_message_preview"`
	UnreadCount        int                `json:"unread_count"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

// ConversationListItem is the list-view projection used by the inbox.
type ConversationListItem struct {
	Conversation
	ContactName      string      `json:"contact_name"`
	ContactAvatarURL *string     `json:"contact_avatar_url"`
	ChannelType      ChannelType `json:"channel_type"`
	ChannelName      string      `json:"channel_name"`
}

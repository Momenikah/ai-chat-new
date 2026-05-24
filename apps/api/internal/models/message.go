package models

import "time"

// MessageDirection — inbound (customer -> us) or outbound (us -> customer).
type MessageDirection string

const (
	MsgInbound  MessageDirection = "inbound"
	MsgOutbound MessageDirection = "outbound"
)

// MessageStatus mirrors the provider delivery state.
type MessageStatus string

const (
	MsgQueued    MessageStatus = "queued"
	MsgSent      MessageStatus = "sent"
	MsgDelivered MessageStatus = "delivered"
	MsgRead      MessageStatus = "read"
	MsgFailed    MessageStatus = "failed"
)

// MessageKind is the content type of a message.
type MessageKind string

const (
	KindText   MessageKind = "text"
	KindImage  MessageKind = "image"
	KindFile   MessageKind = "file"
	KindAudio  MessageKind = "audio"
	KindVideo  MessageKind = "video"
	KindSystem MessageKind = "system"
)

// Valid reports whether k is a known message kind.
func (k MessageKind) Valid() bool {
	switch k {
	case KindText, KindImage, KindFile, KindAudio, KindVideo, KindSystem:
		return true
	default:
		return false
	}
}

// Message is a single message inside a conversation.
type Message struct {
	ID             string           `json:"id"`
	ConversationID string           `json:"conversation_id"`
	WorkspaceID    string           `json:"workspace_id"`
	Direction      MessageDirection `json:"direction"`
	Kind           MessageKind      `json:"kind"`
	Body           *string          `json:"body"`
	Status         MessageStatus    `json:"status"`
	SenderUserID   *string          `json:"sender_user_id"`
	ExternalID     *string          `json:"external_id"`
	CreatedAt      time.Time        `json:"created_at"`
}

// InternalNote is an agent-only annotation on a conversation.
type InternalNote struct {
	ID             string    `json:"id"`
	ConversationID string    `json:"conversation_id"`
	AuthorID       *string   `json:"author_id"`
	AuthorName     *string   `json:"author_name"`
	AuthorEmail    *string   `json:"author_email"`
	Body           string    `json:"body"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

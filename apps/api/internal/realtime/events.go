// Package realtime is the in-memory WebSocket hub that delivers inbox
// events (new message, conversation updated, presence, typing) to all
// connected clients of a workspace.
package realtime

// Event types known to the inbox.
const (
	EventMessageNew           = "message.new"
	EventMessageUpdated       = "message.updated"
	EventConversationUpdated  = "conversation.updated"
	EventConversationAssigned = "conversation.assigned"
	EventNoteNew              = "note.new"
	EventPresenceUpdate       = "presence.update"
	EventTyping               = "typing"
)

// Event is the envelope broadcast to clients. Payload is JSON-encoded.
type Event struct {
	Type        string      `json:"type"`
	WorkspaceID string      `json:"workspace_id"`
	Payload     interface{} `json:"payload,omitempty"`
}

// Broadcaster is what services use to fan-out realtime events. Implemented
// by Hub but stated as an interface so services don't depend on the hub
// transport directly.
type Broadcaster interface {
	Broadcast(workspaceID string, event Event)
}

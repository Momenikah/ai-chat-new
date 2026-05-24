// Package webhook defines outbound webhook events + an asynchronous,
// retrying delivery pipeline.
//
// Services in the rest of the codebase emit events through the
// Dispatcher interface; the default async implementation in
// dispatcher.go signs each delivery with HMAC-SHA256, retries
// transient failures with exponential backoff, and persists every
// attempt to webhook_delivery_logs.
package webhook

import "time"

// Event names the outbound webhook events shipped in Part 10.
type Event string

const (
	EventMessageReceived      Event = "message.received"
	EventMessageSent          Event = "message.sent"
	EventMessageDelivered     Event = "message.delivered"
	EventConversationCreated  Event = "conversation.created"
	EventConversationResolved Event = "conversation.resolved"
	EventContactCreated       Event = "contact.created"
	EventBroadcastCompleted   Event = "broadcast.completed"
)

// AllEvents lists every event the system can emit. Used by the
// dashboard event-picker and by integration docs.
var AllEvents = []Event{
	EventMessageReceived,
	EventMessageSent,
	EventMessageDelivered,
	EventConversationCreated,
	EventConversationResolved,
	EventContactCreated,
	EventBroadcastCompleted,
}

// IsValidEvent reports whether the given string names a real event.
func IsValidEvent(s string) bool {
	for _, e := range AllEvents {
		if string(e) == s {
			return true
		}
	}
	return false
}

// Envelope is the wire format sent to subscriber URLs. Receivers should
// dedupe on `id`, verify HMAC against the raw request body, and use
// `event` to dispatch.
type Envelope struct {
	ID          string      `json:"id"`
	Event       Event       `json:"event"`
	WorkspaceID string      `json:"workspace_id"`
	OccurredAt  time.Time   `json:"occurred_at"`
	Data        interface{} `json:"data"`
}

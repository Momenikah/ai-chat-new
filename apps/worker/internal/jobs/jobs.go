// Package jobs defines the job envelope and job types exchanged between
// the API (producer) and the worker (consumer) via Redis.
package jobs

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Type enumerates the background job kinds handled by the worker.
type Type string

const (
	// TypeSendMessage delivers an outbound message to a channel provider.
	TypeSendMessage Type = "send_message"
	// TypeBroadcast fans a broadcast campaign out to many recipients.
	TypeBroadcast Type = "broadcast"
	// TypeWebhookDelivery posts an event to a customer webhook / n8n.
	TypeWebhookDelivery Type = "webhook_delivery"
)

// Job is the envelope pushed onto the Redis queue. Payload is an opaque
// JSON object interpreted by the processor for the given Type.
type Job struct {
	ID        string          `json:"id"`
	Type      Type            `json:"type"`
	Payload   json.RawMessage `json:"payload"`
	Attempts  int             `json:"attempts"`
	CreatedAt time.Time       `json:"created_at"`
}

// New builds a Job with a generated id and timestamp.
func New(t Type, payload json.RawMessage) Job {
	return Job{
		ID:        uuid.NewString(),
		Type:      t,
		Payload:   payload,
		CreatedAt: time.Now().UTC(),
	}
}

// Marshal serializes the job for transport.
func (j Job) Marshal() ([]byte, error) {
	return json.Marshal(j)
}

// Unmarshal parses a job from its serialized form.
func Unmarshal(raw []byte) (Job, error) {
	var j Job
	err := json.Unmarshal(raw, &j)
	return j, err
}

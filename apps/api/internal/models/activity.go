package models

import (
	"encoding/json"
	"time"
)

// ContactActivity kinds. Free-form text; this list is just convention.
const (
	ActivityContactCreated  = "contact_created"
	ActivityContactImported = "contact_imported"
	ActivityContactMerged   = "contact_merged"
	ActivityContactUpdated  = "contact_updated"
	ActivityNote            = "note"
)

// ContactActivity is one row on a contact's timeline.
type ContactActivity struct {
	ID          string          `json:"id"`
	ContactID   string          `json:"contact_id"`
	WorkspaceID string          `json:"workspace_id"`
	ActorID     *string         `json:"actor_id"`
	ActorName   *string         `json:"actor_name"`
	Kind        string          `json:"kind"`
	Body        *string         `json:"body"`
	Metadata    json.RawMessage `json:"metadata"`
	OccurredAt  time.Time       `json:"occurred_at"`
	CreatedAt   time.Time       `json:"created_at"`
}

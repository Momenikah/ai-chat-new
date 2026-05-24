package models

import (
	"encoding/json"
	"time"
)

// TemplateCategory mirrors the Meta-side template categories.
type TemplateCategory string

const (
	TemplateMarketing      TemplateCategory = "marketing"
	TemplateUtility        TemplateCategory = "utility"
	TemplateAuthentication TemplateCategory = "authentication"
)

// Valid reports whether c is a known template category.
func (c TemplateCategory) Valid() bool {
	switch c {
	case TemplateMarketing, TemplateUtility, TemplateAuthentication:
		return true
	}
	return false
}

// TemplateStatus is the approval lifecycle.
type TemplateStatus string

const (
	TemplateDraft    TemplateStatus = "draft"
	TemplatePending  TemplateStatus = "pending"
	TemplateApproved TemplateStatus = "approved"
	TemplateRejected TemplateStatus = "rejected"
)

// Valid reports whether s is a known template status.
func (s TemplateStatus) Valid() bool {
	switch s {
	case TemplateDraft, TemplatePending, TemplateApproved, TemplateRejected:
		return true
	}
	return false
}

// MessageTemplate is a Meta-style structured message template.
type MessageTemplate struct {
	ID              string           `json:"id"`
	WorkspaceID     string           `json:"workspace_id"`
	Name            string           `json:"name"`
	Category        TemplateCategory `json:"category"`
	Status          TemplateStatus   `json:"status"`
	Language        string           `json:"language"`
	HeaderKind      *string          `json:"header_kind"`
	HeaderContent   *string          `json:"header_content"`
	Body            string           `json:"body"`
	Footer          *string          `json:"footer"`
	Buttons         json.RawMessage  `json:"buttons"`
	ExternalID      *string          `json:"external_id"`
	SubmittedAt     *time.Time       `json:"submitted_at"`
	ApprovedAt      *time.Time       `json:"approved_at"`
	RejectionReason *string          `json:"rejection_reason"`
	CreatedBy       *string          `json:"created_by"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

// TemplateVariable is one {{placeholder}} on a template.
type TemplateVariable struct {
	ID          string    `json:"id"`
	TemplateID  string    `json:"template_id"`
	Name        string    `json:"name"`
	Label       *string   `json:"label"`
	SampleValue *string   `json:"sample_value"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
}

// TemplateWithVariables bundles a template with its variables (used by
// GET endpoints + the editor).
type TemplateWithVariables struct {
	MessageTemplate
	Variables []TemplateVariable `json:"variables"`
}

// TemplateUsage is one row of the usage log.
type TemplateUsage struct {
	ID             string          `json:"id"`
	TemplateID     string          `json:"template_id"`
	WorkspaceID    string          `json:"workspace_id"`
	ConversationID *string         `json:"conversation_id"`
	UsedBy         *string         `json:"used_by"`
	Variables      json.RawMessage `json:"variables"`
	RenderedBody   *string         `json:"rendered_body"`
	UsedAt         time.Time       `json:"used_at"`
}

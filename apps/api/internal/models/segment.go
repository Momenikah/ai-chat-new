package models

import "time"

// Segment is a saved filter view over contacts.
type Segment struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	Color       string    `json:"color"`
	CreatedBy   *string   `json:"created_by"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// SegmentRule is one condition on a segment. Rules within a segment are
// AND-combined; field + operator are validated against a whitelist in the
// segment service.
type SegmentRule struct {
	ID        string    `json:"id"`
	SegmentID string    `json:"segment_id"`
	Field     string    `json:"field"`
	Operator  string    `json:"operator"`
	Value     string    `json:"value"`
	CreatedAt time.Time `json:"created_at"`
}

// SegmentWithRules bundles a segment with its rules (used by GET endpoints).
type SegmentWithRules struct {
	Segment
	Rules        []SegmentRule `json:"rules"`
	MemberCount  int           `json:"member_count"`
}

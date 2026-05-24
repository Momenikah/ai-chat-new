package models

import (
	"encoding/json"
	"time"
)

// AdminAuditLog records one super-admin action for accountability.
type AdminAuditLog struct {
	ID          string          `json:"id"`
	ActorUserID *string         `json:"actor_user_id"`
	ActorEmail  string          `json:"actor_email"`
	Action      string          `json:"action"`
	TargetType  string          `json:"target_type"`
	TargetID    string          `json:"target_id"`
	Metadata    json.RawMessage `json:"metadata"`
	IP          *string         `json:"ip"`
	CreatedAt   time.Time       `json:"created_at"`
}

// AbuseStatus is the lifecycle of an abuse report.
type AbuseStatus string

const (
	AbuseOpen      AbuseStatus = "open"
	AbuseReviewing AbuseStatus = "reviewing"
	AbuseResolved  AbuseStatus = "resolved"
	AbuseDismissed AbuseStatus = "dismissed"
)

// AbuseReport is a spam/abuse report against a workspace.
type AbuseReport struct {
	ID             string      `json:"id"`
	WorkspaceID    *string     `json:"workspace_id"`
	WorkspaceName  *string     `json:"workspace_name,omitempty"`
	ReporterUserID *string     `json:"reporter_user_id"`
	ReporterEmail  *string     `json:"reporter_email"`
	Category       string      `json:"category"`
	Description    string      `json:"description"`
	Status         AbuseStatus `json:"status"`
	ResolutionNote *string     `json:"resolution_note"`
	ResolvedBy     *string     `json:"resolved_by"`
	ResolvedAt     *time.Time  `json:"resolved_at"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

// SystemLogLevel is the severity of a system log entry.
type SystemLogLevel string

const (
	LogDebug SystemLogLevel = "debug"
	LogInfo  SystemLogLevel = "info"
	LogWarn  SystemLogLevel = "warn"
	LogError SystemLogLevel = "error"
)

// SystemLog is one application/system event for the admin log viewer.
type SystemLog struct {
	ID          string          `json:"id"`
	Level       SystemLogLevel  `json:"level"`
	Source      string          `json:"source"`
	Message     string          `json:"message"`
	Context     json.RawMessage `json:"context"`
	WorkspaceID *string         `json:"workspace_id"`
	CreatedAt   time.Time       `json:"created_at"`
}

// PlatformOverview is the super-admin landing dashboard payload.
type PlatformOverview struct {
	TotalWorkspaces      int64                `json:"total_workspaces"`
	SuspendedWorkspaces  int64                `json:"suspended_workspaces"`
	TotalUsers           int64                `json:"total_users"`
	TotalMessages        int64                `json:"total_messages"`
	TotalActiveChannels  int64                `json:"total_active_channels"`
	RevenueIDR           int64                `json:"revenue_idr"`
	OpenReports          int64                `json:"open_reports"`
	PlanBreakdown        []PlatformPlanCount  `json:"plan_breakdown"`
	RecentSignups        []AdminUserListItem  `json:"recent_signups"`
}

// PlatformPlanCount is a per-plan workspace count for the overview chart.
type PlatformPlanCount struct {
	PlanCode string `json:"plan_code"`
	Count    int64  `json:"count"`
}

// AdminUserListItem is an enriched user row for the admin users table.
type AdminUserListItem struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	AvatarURL      *string    `json:"avatar_url"`
	IsActive       bool       `json:"is_active"`
	IsSuperAdmin   bool       `json:"is_super_admin"`
	WorkspaceCount int        `json:"workspace_count"`
	LastLoginAt    *time.Time `json:"last_login_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

// AdminWorkspaceListItem is an enriched workspace row for the admin table.
type AdminWorkspaceListItem struct {
	ID                 string     `json:"id"`
	Name               string     `json:"name"`
	Slug               string     `json:"slug"`
	OwnerEmail         *string    `json:"owner_email"`
	MemberCount        int        `json:"member_count"`
	ChannelCount       int        `json:"channel_count"`
	PlanCode           *string    `json:"plan_code"`
	SubscriptionStatus *string    `json:"subscription_status"`
	SuspendedAt        *time.Time `json:"suspended_at"`
	CreatedAt          time.Time  `json:"created_at"`
}

// AdminSubscriptionListItem is a subscription row joined with workspace+plan.
type AdminSubscriptionListItem struct {
	ID               string     `json:"id"`
	WorkspaceID      string     `json:"workspace_id"`
	WorkspaceName    string     `json:"workspace_name"`
	PlanCode         string     `json:"plan_code"`
	PlanName         string     `json:"plan_name"`
	PriceIDR         int64      `json:"price_idr"`
	Status           string     `json:"status"`
	CurrentPeriodEnd *time.Time `json:"current_period_end"`
	CreatedAt        time.Time  `json:"created_at"`
}

// AdminChannelListItem is a channel row for the admin table. It deliberately
// EXCLUDES any credential/token material — only a has_credentials flag.
type AdminChannelListItem struct {
	ID             string     `json:"id"`
	WorkspaceID    string     `json:"workspace_id"`
	WorkspaceName  string     `json:"workspace_name"`
	Type           string     `json:"type"`
	Name           string     `json:"name"`
	Status         string     `json:"status"`
	ExternalID     *string    `json:"external_id"`
	HasCredentials bool       `json:"has_credentials"`
	LastConnected  *time.Time `json:"last_connected_at"`
	CreatedAt      time.Time  `json:"created_at"`
}

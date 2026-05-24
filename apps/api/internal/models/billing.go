package models

import "time"

// PlanLimits is the typed view of saas_plans.limits. Numeric limits use
// -1 to mean "unlimited" and 0 to mean "feature off". Boolean fields gate
// whole capabilities.
type PlanLimits struct {
	TeamMembers        int  `json:"team_members"`
	KnowledgeDocuments int  `json:"knowledge_documents"`
	WhatsAppNumbers    int  `json:"whatsapp_numbers"`
	MessageHistoryDays int  `json:"message_history_days"`
	APIAccess          bool `json:"api_access"`
	N8NIntegration     bool `json:"n8n_integration"`
	AIChatbot          bool `json:"ai_chatbot"`
}

// SaasPlan is one row of the pricing catalogue.
type SaasPlan struct {
	ID            string     `json:"id"`
	Code          string     `json:"code"`
	Name          string     `json:"name"`
	Description   string     `json:"description"`
	PriceIDR      int64      `json:"price_idr"`
	BillingPeriod string     `json:"billing_period"`
	Features      []string   `json:"features"`
	Limits        PlanLimits `json:"limits"`
	IsActive      bool       `json:"is_active"`
	SortOrder     int        `json:"sort_order"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
}

// SubscriptionStatus enumerates the lifecycle of a subscription.
type SubscriptionStatus string

const (
	SubTrial     SubscriptionStatus = "trial"
	SubActive    SubscriptionStatus = "active"
	SubPastDue   SubscriptionStatus = "past_due"
	SubCancelled SubscriptionStatus = "cancelled"
)

// Entitled reports whether a subscription in this status grants its plan's
// paid entitlements. past_due / cancelled fall back to FREE.
func (s SubscriptionStatus) Entitled() bool {
	return s == SubTrial || s == SubActive
}

// SaasSubscription is the per-workspace subscription record.
type SaasSubscription struct {
	ID                 string             `json:"id"`
	WorkspaceID        string             `json:"workspace_id"`
	PlanID             string             `json:"plan_id"`
	Status             SubscriptionStatus `json:"status"`
	TrialEndsAt        *time.Time         `json:"trial_ends_at"`
	CurrentPeriodStart time.Time          `json:"current_period_start"`
	CurrentPeriodEnd   *time.Time         `json:"current_period_end"`
	CancelAtPeriodEnd  bool               `json:"cancel_at_period_end"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

// BillingSummary bundles a subscription with its resolved plan for the
// billing dashboard.
type BillingSummary struct {
	Subscription *SaasSubscription `json:"subscription"`
	Plan         *SaasPlan         `json:"plan"`
}

// UsageMetric is one current-usage figure paired with its plan limit.
type UsageMetric struct {
	Metric    string `json:"metric"`
	Label     string `json:"label"`
	Used      int64  `json:"used"`
	Limit     int    `json:"limit"`     // -1 = unlimited, 0 = not available
	Unlimited bool   `json:"unlimited"`
}

// UsageSummary is what the usage dashboard renders.
type UsageSummary struct {
	PlanCode string        `json:"plan_code"`
	Metrics  []UsageMetric `json:"metrics"`
}

// UsageRecord is a stored daily snapshot of a single metric.
type UsageRecord struct {
	ID          string    `json:"id"`
	WorkspaceID string    `json:"workspace_id"`
	Metric      string    `json:"metric"`
	Value       int64     `json:"value"`
	RecordedOn  time.Time `json:"recorded_on"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// InvoiceStatus enumerates the lifecycle of an invoice.
type InvoiceStatus string

const (
	InvoiceDraft InvoiceStatus = "draft"
	InvoiceOpen  InvoiceStatus = "open"
	InvoicePaid  InvoiceStatus = "paid"
	InvoiceVoid  InvoiceStatus = "void"
)

// Invoice is a (placeholder) billing invoice.
type Invoice struct {
	ID              string        `json:"id"`
	WorkspaceID     string        `json:"workspace_id"`
	SubscriptionID  *string       `json:"subscription_id"`
	Number          string        `json:"number"`
	AmountIDR       int64         `json:"amount_idr"`
	Status          InvoiceStatus `json:"status"`
	PeriodStart     *time.Time    `json:"period_start"`
	PeriodEnd       *time.Time    `json:"period_end"`
	PaidAt          *time.Time    `json:"paid_at"`
	PaymentProvider *string       `json:"payment_provider"`
	PaymentRef      *string       `json:"payment_ref"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aichat/api/internal/midtrans"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Billing service errors.
var (
	ErrPlanNotFound      = errors.New("plan not found")
	ErrFreePlanMissing   = errors.New("FREE plan not seeded")
	ErrSamePlan          = errors.New("workspace is already on this plan")
	ErrSubscriptionError = errors.New("could not resolve subscription")
)

// monthlyPeriod is how long a paid period lasts in this dummy billing flow.
const monthlyPeriod = 30 * 24 * time.Hour

// BillingService implements pricing, subscription management, usage
// reporting and (placeholder) invoicing.
type BillingService struct {
	billing  *repositories.BillingRepository
	members  *repositories.WorkspaceMemberRepository
	ai       *repositories.AIRepository
	channels *repositories.ChannelRepository
	messages *repositories.MessageRepository
	apiKeys  *repositories.APIKeyRepository
	payments *midtrans.Client
}

// NewBillingService constructs a BillingService.
func NewBillingService(
	billing *repositories.BillingRepository,
	members *repositories.WorkspaceMemberRepository,
	ai *repositories.AIRepository,
	channels *repositories.ChannelRepository,
	messages *repositories.MessageRepository,
	apiKeys *repositories.APIKeyRepository,
	payments *midtrans.Client,
) *BillingService {
	return &BillingService{
		billing: billing, members: members, ai: ai, channels: channels,
		messages: messages, apiKeys: apiKeys, payments: payments,
	}
}

// ListPlans returns the active pricing catalogue.
func (s *BillingService) ListPlans(ctx context.Context) ([]models.SaasPlan, error) {
	return s.billing.ListActivePlans(ctx)
}

// GetBilling returns the workspace's subscription + plan, lazily creating a
// FREE/active subscription on first access.
func (s *BillingService) GetBilling(ctx context.Context, workspaceID string) (*models.BillingSummary, error) {
	sub, err := s.resolveSubscription(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	plan, err := s.billing.GetPlanByID(ctx, sub.PlanID)
	if err != nil {
		return nil, err
	}
	return &models.BillingSummary{Subscription: sub, Plan: plan}, nil
}

// ChangePlanResult bundles the new billing state with the (placeholder)
// payment + invoice produced by the switch.
type ChangePlanResult struct {
	Billing *models.BillingSummary   `json:"billing"`
	Invoice *models.Invoice          `json:"invoice,omitempty"`
	Payment *midtrans.Transaction    `json:"payment,omitempty"`
}

// ChangePlan switches a workspace to another plan. For paid plans this runs
// the placeholder Midtrans flow and records a paid invoice; downgrading to
// FREE just flips the subscription. This is intentionally a dummy flow — no
// real money moves.
func (s *BillingService) ChangePlan(ctx context.Context, workspaceID, planCode string) (*ChangePlanResult, error) {
	plan, err := s.billing.GetPlanByCode(ctx, planCode)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrPlanNotFound
		}
		return nil, err
	}

	sub, err := s.resolveSubscription(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var periodEnd *time.Time
	status := models.SubActive
	if plan.PriceIDR > 0 {
		end := now.Add(monthlyPeriod)
		periodEnd = &end
	}

	updated, err := s.billing.UpdateSubscription(ctx, repositories.UpdateSubscriptionParams{
		ID:                 sub.ID,
		PlanID:             plan.ID,
		Status:             status,
		CurrentPeriodStart: now,
		CurrentPeriodEnd:   periodEnd,
		CancelAtPeriodEnd:  false,
	})
	if err != nil {
		return nil, err
	}

	result := &ChangePlanResult{
		Billing: &models.BillingSummary{Subscription: updated, Plan: plan},
	}

	// Paid plan → run the placeholder payment + create a paid invoice.
	if plan.PriceIDR > 0 {
		invoice, payment, err := s.createPaidInvoice(ctx, workspaceID, updated, plan, now, periodEnd)
		if err != nil {
			return nil, err
		}
		result.Invoice = invoice
		result.Payment = payment
	}

	return result, nil
}

// GetUsage computes current usage versus the effective plan limits and
// persists today's snapshot rows for the trend.
func (s *BillingService) GetUsage(ctx context.Context, workspaceID string) (*models.UsageSummary, error) {
	plan, err := s.effectivePlan(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	limits := plan.Limits

	teamCount, _ := s.members.Count(ctx, workspaceID)

	knowledgeDocs, _ := s.ai.ListKnowledgeDocuments(ctx, workspaceID)
	knowledgeCount := len(knowledgeDocs)

	waCount := s.countWhatsAppNumbers(ctx, workspaceID)

	retentionDays := limits.MessageHistoryDays
	since := messageSince(retentionDays)
	msgCount, _ := s.messages.CountByWorkspaceSince(ctx, workspaceID, since)

	apiSince := time.Now().AddDate(0, 0, -30)
	apiCount, _ := s.apiKeys.CountUsageSince(ctx, workspaceID, apiSince)

	metrics := []models.UsageMetric{
		usageMetric("team_members", "Team Members", int64(teamCount), limits.TeamMembers),
		usageMetric("knowledge_documents", "Knowledge Documents", int64(knowledgeCount), limits.KnowledgeDocuments),
		usageMetric("whatsapp_numbers", "WhatsApp Numbers", int64(waCount), limits.WhatsAppNumbers),
		usageMetric("messages", "Messages (retensi)", msgCount, -1),
		usageMetric("api_calls", "API Calls (30 hari)", apiCount, -1),
	}

	// Persist today's snapshots (best-effort; ignore errors).
	_ = s.billing.UpsertUsageSnapshot(ctx, workspaceID, "team_members", int64(teamCount))
	_ = s.billing.UpsertUsageSnapshot(ctx, workspaceID, "knowledge_documents", int64(knowledgeCount))
	_ = s.billing.UpsertUsageSnapshot(ctx, workspaceID, "whatsapp_numbers", int64(waCount))
	_ = s.billing.UpsertUsageSnapshot(ctx, workspaceID, "messages", msgCount)
	_ = s.billing.UpsertUsageSnapshot(ctx, workspaceID, "api_calls", apiCount)

	return &models.UsageSummary{PlanCode: plan.Code, Metrics: metrics}, nil
}

// ListInvoices returns the workspace's invoices.
func (s *BillingService) ListInvoices(ctx context.Context, workspaceID string) ([]models.Invoice, error) {
	return s.billing.ListInvoices(ctx, workspaceID)
}

/* ----------------------------- internal ------------------------------- */

// resolveSubscription returns the workspace's subscription, lazily creating
// a FREE/active one if none exists.
func (s *BillingService) resolveSubscription(ctx context.Context, workspaceID string) (*models.SaasSubscription, error) {
	sub, err := s.billing.GetSubscriptionByWorkspace(ctx, workspaceID)
	if err == nil {
		return sub, nil
	}
	if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	free, err := s.billing.GetPlanByCode(ctx, "FREE")
	if err != nil {
		return nil, ErrFreePlanMissing
	}
	return s.billing.CreateSubscription(ctx, repositories.CreateSubscriptionParams{
		WorkspaceID:        workspaceID,
		PlanID:             free.ID,
		Status:             models.SubActive,
		CurrentPeriodStart: time.Now().UTC(),
	})
}

// effectivePlan returns the plan whose entitlements currently apply. A
// past_due / cancelled subscription falls back to FREE.
func (s *BillingService) effectivePlan(ctx context.Context, workspaceID string) (*models.SaasPlan, error) {
	sub, err := s.resolveSubscription(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if sub.Status.Entitled() {
		return s.billing.GetPlanByID(ctx, sub.PlanID)
	}
	free, err := s.billing.GetPlanByCode(ctx, "FREE")
	if err != nil {
		return nil, ErrFreePlanMissing
	}
	return free, nil
}

func (s *BillingService) createPaidInvoice(ctx context.Context, workspaceID string, sub *models.SaasSubscription, plan *models.SaasPlan, start time.Time, end *time.Time) (*models.Invoice, *midtrans.Transaction, error) {
	count, _ := s.billing.CountInvoices(ctx, workspaceID)
	number := fmt.Sprintf("INV-%s-%04d", start.Format("200601"), count+1)

	payment, err := s.payments.CreateTransaction(midtrans.Charge{
		OrderID:    number,
		AmountIDR:  plan.PriceIDR,
		CustomerID: workspaceID,
		ItemName:   "Langganan " + plan.Name,
	})
	if err != nil {
		return nil, nil, err
	}

	// Placeholder Midtrans returns "settlement" immediately → mark paid.
	paid := payment.Status == "settlement"
	status := models.InvoiceOpen
	var paidAt *time.Time
	if paid {
		status = models.InvoicePaid
		paidAt = &start
	}
	provider := "midtrans (placeholder)"
	ref := payment.TransactionID
	subID := sub.ID

	invoice, err := s.billing.CreateInvoice(ctx, repositories.CreateInvoiceParams{
		WorkspaceID:     workspaceID,
		SubscriptionID:  &subID,
		Number:          number,
		AmountIDR:       plan.PriceIDR,
		Status:          status,
		PeriodStart:     &start,
		PeriodEnd:       end,
		PaidAt:          paidAt,
		PaymentProvider: &provider,
		PaymentRef:      &ref,
	})
	if err != nil {
		return nil, nil, err
	}
	return invoice, payment, nil
}

func (s *BillingService) countWhatsAppNumbers(ctx context.Context, workspaceID string) int {
	channels, err := s.channels.ListByWorkspace(ctx, workspaceID)
	if err != nil {
		return 0
	}
	n := 0
	for _, c := range channels {
		if c.Type == models.ChannelWhatsApp {
			n++
		}
	}
	return n
}

func usageMetric(metric, label string, used int64, limit int) models.UsageMetric {
	return models.UsageMetric{
		Metric:    metric,
		Label:     label,
		Used:      used,
		Limit:     limit,
		Unlimited: limit < 0,
	}
}

// messageSince converts a retention-day count into a cutoff time. -1 (or
// any non-positive) means unlimited → epoch.
func messageSince(days int) time.Time {
	if days <= 0 {
		return time.Unix(0, 0)
	}
	return time.Now().AddDate(0, 0, -days)
}

package services

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Plan-enforcement errors.
var (
	// ErrPlanLimitReached is returned when adding a resource would exceed
	// the plan's numeric limit.
	ErrPlanLimitReached = errors.New("plan limit reached")
	// ErrFeatureNotInPlan is returned when a gated capability is not
	// included in the current plan.
	ErrFeatureNotInPlan = errors.New("feature not available on current plan")
)

// PlanLimitError carries the specifics of a limit breach so handlers can
// build a helpful upgrade message.
type PlanLimitError struct {
	Resource string
	Limit    int
	Current  int
}

func (e *PlanLimitError) Error() string {
	return fmt.Sprintf("plan limit reached for %s (limit %d, current %d)",
		e.Resource, e.Limit, e.Current)
}

func (e *PlanLimitError) Is(target error) bool { return target == ErrPlanLimitReached }

// FeatureError carries which feature was gated.
type FeatureError struct{ Feature string }

func (e *FeatureError) Error() string {
	return fmt.Sprintf("feature %q not available on current plan", e.Feature)
}

func (e *FeatureError) Is(target error) bool { return target == ErrFeatureNotInPlan }

// Feature + resource keys used across the enforcement points.
const (
	FeatureAPIAccess = "api_access"
	FeatureN8N       = "n8n_integration"
	FeatureAIChatbot = "ai_chatbot"

	ResourceTeamMembers        = "team_members"
	ResourceKnowledgeDocuments = "knowledge_documents"
	ResourceWhatsAppNumbers    = "whatsapp_numbers"
)

// PlanEnforcer is the slice of plan logic that feature services depend on.
// Implemented by PlanGuard. Services hold this interface (nil-safe via the
// helper methods below) so billing can be wired in without import cycles.
type PlanEnforcer interface {
	EnsureFeature(ctx context.Context, workspaceID, feature string) error
	EnsureCanAdd(ctx context.Context, workspaceID, resource string, currentCount int) error
	RetentionCutoff(ctx context.Context, workspaceID string) *time.Time
}

// PlanGuard resolves a workspace's effective plan and answers entitlement
// questions. past_due / cancelled subscriptions fall back to FREE.
type PlanGuard struct {
	billing *repositories.BillingRepository
}

// NewPlanGuard constructs a PlanGuard.
func NewPlanGuard(billing *repositories.BillingRepository) *PlanGuard {
	return &PlanGuard{billing: billing}
}

// EnsureFeature returns ErrFeatureNotInPlan when the gated capability is
// off for the workspace's plan. Fails open if the plan can't be resolved
// (so a billing outage never hard-blocks core features).
func (g *PlanGuard) EnsureFeature(ctx context.Context, workspaceID, feature string) error {
	limits, ok := g.limits(ctx, workspaceID)
	if !ok {
		return nil
	}
	enabled := false
	switch feature {
	case FeatureAPIAccess:
		enabled = limits.APIAccess
	case FeatureN8N:
		enabled = limits.N8NIntegration
	case FeatureAIChatbot:
		enabled = limits.AIChatbot
	default:
		enabled = true
	}
	if !enabled {
		return &FeatureError{Feature: feature}
	}
	return nil
}

// EnsureCanAdd returns ErrPlanLimitReached when adding one more of the
// resource (given currentCount existing) would exceed the plan limit. A
// limit of -1 means unlimited; 0 means the resource is unavailable.
func (g *PlanGuard) EnsureCanAdd(ctx context.Context, workspaceID, resource string, currentCount int) error {
	limits, ok := g.limits(ctx, workspaceID)
	if !ok {
		return nil
	}
	limit := resourceLimit(limits, resource)
	if limit < 0 {
		return nil // unlimited
	}
	if currentCount >= limit {
		return &PlanLimitError{Resource: resource, Limit: limit, Current: currentCount}
	}
	return nil
}

// RetentionCutoff returns the oldest timestamp messages should remain
// visible per the plan's message-history window, or nil for unlimited.
func (g *PlanGuard) RetentionCutoff(ctx context.Context, workspaceID string) *time.Time {
	limits, ok := g.limits(ctx, workspaceID)
	if !ok {
		return nil
	}
	if limits.MessageHistoryDays <= 0 {
		return nil
	}
	cutoff := time.Now().AddDate(0, 0, -limits.MessageHistoryDays)
	return &cutoff
}

// limits resolves the effective plan limits for a workspace. The bool is
// false when the plan can't be resolved (caller should fail open).
func (g *PlanGuard) limits(ctx context.Context, workspaceID string) (models.PlanLimits, bool) {
	sub, err := g.billing.GetSubscriptionByWorkspace(ctx, workspaceID)
	if err != nil {
		// No subscription yet → treat as FREE.
		if free, fErr := g.billing.GetPlanByCode(ctx, "FREE"); fErr == nil {
			return free.Limits, true
		}
		return models.PlanLimits{}, false
	}
	planID := sub.PlanID
	if !sub.Status.Entitled() {
		if free, fErr := g.billing.GetPlanByCode(ctx, "FREE"); fErr == nil {
			return free.Limits, true
		}
		return models.PlanLimits{}, false
	}
	plan, err := g.billing.GetPlanByID(ctx, planID)
	if err != nil {
		return models.PlanLimits{}, false
	}
	return plan.Limits, true
}

func resourceLimit(l models.PlanLimits, resource string) int {
	switch resource {
	case ResourceTeamMembers:
		return l.TeamMembers
	case ResourceKnowledgeDocuments:
		return l.KnowledgeDocuments
	case ResourceWhatsAppNumbers:
		return l.WhatsAppNumbers
	default:
		return -1
	}
}

/* --------- nil-safe helpers for services holding a PlanEnforcer -------- */

// ensureFeature applies a feature gate when an enforcer is wired. A nil
// enforcer means "no billing" → allow.
func ensureFeature(enforcer PlanEnforcer, ctx context.Context, workspaceID, feature string) error {
	if enforcer == nil {
		return nil
	}
	return enforcer.EnsureFeature(ctx, workspaceID, feature)
}

// ensureCanAdd applies a numeric-limit gate when an enforcer is wired.
func ensureCanAdd(enforcer PlanEnforcer, ctx context.Context, workspaceID, resource string, currentCount int) error {
	if enforcer == nil {
		return nil
	}
	return enforcer.EnsureCanAdd(ctx, workspaceID, resource, currentCount)
}

package repositories

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/aichat/api/internal/models"
)

// BillingRepository persists plans, subscriptions, usage snapshots, and
// invoices.
type BillingRepository struct {
	db DBTX
}

// NewBillingRepository constructs a BillingRepository.
func NewBillingRepository(db DBTX) *BillingRepository {
	return &BillingRepository{db: db}
}

const planColumns = `
	id::text, code, name, description, price_idr, billing_period,
	features, limits, is_active, sort_order, created_at, updated_at`

const subscriptionColumns = `
	id::text, workspace_id::text, plan_id::text, status::text, trial_ends_at,
	current_period_start, current_period_end, cancel_at_period_end,
	created_at, updated_at`

const invoiceColumns = `
	id::text, workspace_id::text, subscription_id::text, number, amount_idr,
	status::text, period_start, period_end, paid_at, payment_provider,
	payment_ref, created_at, updated_at`

// --- plans -------------------------------------------------------------

// ListActivePlans returns the active plans ordered for the pricing page.
func (r *BillingRepository) ListActivePlans(ctx context.Context) ([]models.SaasPlan, error) {
	const q = `SELECT ` + planColumns + ` FROM saas_plans
		WHERE is_active = TRUE ORDER BY sort_order ASC, price_idr ASC`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.SaasPlan{}
	for rows.Next() {
		p, err := scanPlanRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *p)
	}
	return out, rows.Err()
}

// GetPlanByID fetches a plan by id.
func (r *BillingRepository) GetPlanByID(ctx context.Context, id string) (*models.SaasPlan, error) {
	const q = `SELECT ` + planColumns + ` FROM saas_plans WHERE id = $1`
	return scanPlan(r.db.QueryRow(ctx, q, id))
}

// GetPlanByCode fetches a plan by its code (FREE/BASIC/LITE).
func (r *BillingRepository) GetPlanByCode(ctx context.Context, code string) (*models.SaasPlan, error) {
	const q = `SELECT ` + planColumns + ` FROM saas_plans WHERE code = $1`
	return scanPlan(r.db.QueryRow(ctx, q, code))
}

// --- subscriptions -----------------------------------------------------

// GetSubscriptionByWorkspace fetches the workspace's subscription.
func (r *BillingRepository) GetSubscriptionByWorkspace(ctx context.Context, workspaceID string) (*models.SaasSubscription, error) {
	const q = `SELECT ` + subscriptionColumns + ` FROM saas_subscriptions WHERE workspace_id = $1`
	return scanSubscription(r.db.QueryRow(ctx, q, workspaceID))
}

// CreateSubscriptionParams holds inputs for inserting a subscription.
type CreateSubscriptionParams struct {
	WorkspaceID        string
	PlanID             string
	Status             models.SubscriptionStatus
	TrialEndsAt        *time.Time
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   *time.Time
}

// CreateSubscription inserts a new subscription.
func (r *BillingRepository) CreateSubscription(ctx context.Context, p CreateSubscriptionParams) (*models.SaasSubscription, error) {
	const q = `INSERT INTO saas_subscriptions
		(workspace_id, plan_id, status, trial_ends_at, current_period_start, current_period_end)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING ` + subscriptionColumns
	return scanSubscription(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.PlanID, string(p.Status), p.TrialEndsAt,
		p.CurrentPeriodStart, p.CurrentPeriodEnd,
	))
}

// UpdateSubscriptionParams holds inputs for changing a subscription.
type UpdateSubscriptionParams struct {
	ID                 string
	PlanID             string
	Status             models.SubscriptionStatus
	TrialEndsAt        *time.Time
	CurrentPeriodStart time.Time
	CurrentPeriodEnd   *time.Time
	CancelAtPeriodEnd  bool
}

// UpdateSubscription saves a subscription change (e.g. plan switch).
func (r *BillingRepository) UpdateSubscription(ctx context.Context, p UpdateSubscriptionParams) (*models.SaasSubscription, error) {
	const q = `UPDATE saas_subscriptions
		SET plan_id = $2, status = $3, trial_ends_at = $4,
		    current_period_start = $5, current_period_end = $6,
		    cancel_at_period_end = $7, updated_at = now()
		WHERE id = $1
		RETURNING ` + subscriptionColumns
	return scanSubscription(r.db.QueryRow(ctx, q,
		p.ID, p.PlanID, string(p.Status), p.TrialEndsAt,
		p.CurrentPeriodStart, p.CurrentPeriodEnd, p.CancelAtPeriodEnd,
	))
}

// --- usage records -----------------------------------------------------

// UpsertUsageSnapshot writes today's value for one metric (idempotent per
// day via the unique (workspace, metric, recorded_on) constraint).
func (r *BillingRepository) UpsertUsageSnapshot(ctx context.Context, workspaceID, metric string, value int64) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO usage_records (workspace_id, metric, value, recorded_on)
		VALUES ($1, $2, $3, CURRENT_DATE)
		ON CONFLICT (workspace_id, metric, recorded_on)
		DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
		workspaceID, metric, value)
	return err
}

// --- invoices ----------------------------------------------------------

// CreateInvoiceParams holds inputs for inserting an invoice.
type CreateInvoiceParams struct {
	WorkspaceID     string
	SubscriptionID  *string
	Number          string
	AmountIDR       int64
	Status          models.InvoiceStatus
	PeriodStart     *time.Time
	PeriodEnd       *time.Time
	PaidAt          *time.Time
	PaymentProvider *string
	PaymentRef      *string
}

// CreateInvoice inserts an invoice row.
func (r *BillingRepository) CreateInvoice(ctx context.Context, p CreateInvoiceParams) (*models.Invoice, error) {
	const q = `INSERT INTO invoices
		(workspace_id, subscription_id, number, amount_idr, status,
		 period_start, period_end, paid_at, payment_provider, payment_ref)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING ` + invoiceColumns
	return scanInvoice(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.SubscriptionID, p.Number, p.AmountIDR, string(p.Status),
		p.PeriodStart, p.PeriodEnd, p.PaidAt, p.PaymentProvider, p.PaymentRef,
	))
}

// ListInvoices returns the workspace's invoices, newest first.
func (r *BillingRepository) ListInvoices(ctx context.Context, workspaceID string) ([]models.Invoice, error) {
	const q = `SELECT ` + invoiceColumns + ` FROM invoices
		WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.Invoice{}
	for rows.Next() {
		inv, err := scanInvoiceRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *inv)
	}
	return out, rows.Err()
}

// CountInvoices returns how many invoices a workspace has (used to build
// the next invoice number).
func (r *BillingRepository) CountInvoices(ctx context.Context, workspaceID string) (int, error) {
	var n int
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM invoices WHERE workspace_id = $1`, workspaceID).Scan(&n)
	return n, err
}

// --- scan helpers ------------------------------------------------------

func scanPlan(row pgx.Row) (*models.SaasPlan, error) {
	p, err := scanPlanRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return p, nil
}

func scanPlanRow(row pgx.Row) (*models.SaasPlan, error) {
	var p models.SaasPlan
	var features, limits []byte
	if err := row.Scan(
		&p.ID, &p.Code, &p.Name, &p.Description, &p.PriceIDR, &p.BillingPeriod,
		&features, &limits, &p.IsActive, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	); err != nil {
		return nil, err
	}
	if len(features) > 0 {
		_ = json.Unmarshal(features, &p.Features)
	}
	if p.Features == nil {
		p.Features = []string{}
	}
	if len(limits) > 0 {
		_ = json.Unmarshal(limits, &p.Limits)
	}
	return &p, nil
}

func scanSubscription(row pgx.Row) (*models.SaasSubscription, error) {
	var s models.SaasSubscription
	var status string
	err := row.Scan(
		&s.ID, &s.WorkspaceID, &s.PlanID, &status, &s.TrialEndsAt,
		&s.CurrentPeriodStart, &s.CurrentPeriodEnd, &s.CancelAtPeriodEnd,
		&s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	s.Status = models.SubscriptionStatus(status)
	return &s, nil
}

func scanInvoice(row pgx.Row) (*models.Invoice, error) {
	inv, err := scanInvoiceRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return inv, nil
}

func scanInvoiceRow(row pgx.Row) (*models.Invoice, error) {
	var inv models.Invoice
	var status string
	if err := row.Scan(
		&inv.ID, &inv.WorkspaceID, &inv.SubscriptionID, &inv.Number, &inv.AmountIDR,
		&status, &inv.PeriodStart, &inv.PeriodEnd, &inv.PaidAt,
		&inv.PaymentProvider, &inv.PaymentRef, &inv.CreatedAt, &inv.UpdatedAt,
	); err != nil {
		return nil, err
	}
	inv.Status = models.InvoiceStatus(status)
	return &inv, nil
}

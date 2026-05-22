package repositories

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	"github.com/aichat/api/internal/models"
)

// AdminRepository backs the super-admin dashboard: platform aggregates,
// cross-tenant listings, audit logs, abuse reports and system logs.
//
// Every listing here is platform-wide (no workspace scoping) and is only
// ever reached after the RequireSuperAdmin middleware.
type AdminRepository struct {
	db DBTX
}

// NewAdminRepository constructs an AdminRepository.
func NewAdminRepository(db DBTX) *AdminRepository {
	return &AdminRepository{db: db}
}

// --- overview ----------------------------------------------------------

// Overview computes the platform-level counters.
func (r *AdminRepository) Overview(ctx context.Context) (*models.PlatformOverview, error) {
	o := &models.PlatformOverview{}
	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM workspaces`).Scan(&o.TotalWorkspaces); err != nil {
		return nil, err
	}
	_ = r.db.QueryRow(ctx, `SELECT count(*) FROM workspaces WHERE suspended_at IS NOT NULL`).Scan(&o.SuspendedWorkspaces)
	_ = r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&o.TotalUsers)
	_ = r.db.QueryRow(ctx, `SELECT count(*) FROM messages`).Scan(&o.TotalMessages)
	_ = r.db.QueryRow(ctx, `SELECT count(*) FROM channels WHERE status = 'connected'`).Scan(&o.TotalActiveChannels)
	_ = r.db.QueryRow(ctx, `SELECT coalesce(sum(amount_idr), 0) FROM invoices WHERE status = 'paid'`).Scan(&o.RevenueIDR)
	_ = r.db.QueryRow(ctx, `SELECT count(*) FROM abuse_reports WHERE status = 'open'`).Scan(&o.OpenReports)

	breakdown, err := r.planBreakdown(ctx)
	if err != nil {
		return nil, err
	}
	o.PlanBreakdown = breakdown

	signups, err := r.ListUsers(ctx, "", 5, 0)
	if err != nil {
		return nil, err
	}
	o.RecentSignups = signups
	return o, nil
}

func (r *AdminRepository) planBreakdown(ctx context.Context) ([]models.PlatformPlanCount, error) {
	// Count active subscriptions per plan. Workspaces that have never opened
	// billing have no row yet (treated as implicit FREE by the app).
	const q = `
		SELECT p.code, count(s.id)
		FROM saas_plans p
		LEFT JOIN saas_subscriptions s ON s.plan_id = p.id
		GROUP BY p.code, p.sort_order
		ORDER BY p.sort_order`
	rows, err := r.db.Query(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.PlatformPlanCount{}
	for rows.Next() {
		var c models.PlatformPlanCount
		if err := rows.Scan(&c.PlanCode, &c.Count); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// --- users -------------------------------------------------------------

// ListUsers returns enriched user rows. `search` filters name/email.
func (r *AdminRepository) ListUsers(ctx context.Context, search string, limit, offset int) ([]models.AdminUserListItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args := []any{}
	where := ""
	if search != "" {
		args = append(args, "%"+search+"%")
		where = `WHERE lower(u.name) LIKE lower($1) OR lower(u.email) LIKE lower($1)`
	}
	args = append(args, limit, offset)
	q := `
		SELECT u.id::text, u.name, u.email, u.avatar_url, u.is_active,
		       u.is_super_admin, u.last_login_at, u.created_at,
		       (SELECT count(*) FROM workspace_members m WHERE m.user_id = u.id) AS ws_count
		FROM users u
		` + where + `
		ORDER BY u.created_at DESC
		LIMIT $` + itoa(len(args)-1) + ` OFFSET $` + itoa(len(args))
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminUserListItem{}
	for rows.Next() {
		var u models.AdminUserListItem
		if err := rows.Scan(
			&u.ID, &u.Name, &u.Email, &u.AvatarURL, &u.IsActive,
			&u.IsSuperAdmin, &u.LastLoginAt, &u.CreatedAt, &u.WorkspaceCount,
		); err != nil {
			return nil, err
		}
		out = append(out, u)
	}
	return out, rows.Err()
}

// --- workspaces --------------------------------------------------------

// ListWorkspaces returns enriched workspace rows with owner, counts, plan.
func (r *AdminRepository) ListWorkspaces(ctx context.Context, search string, limit, offset int) ([]models.AdminWorkspaceListItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	args := []any{}
	where := ""
	if search != "" {
		args = append(args, "%"+search+"%")
		where = `WHERE lower(w.name) LIKE lower($1) OR lower(w.slug) LIKE lower($1)`
	}
	args = append(args, limit, offset)
	q := `
		SELECT w.id::text, w.name, w.slug, w.suspended_at, w.created_at,
		       ow.email AS owner_email,
		       (SELECT count(*) FROM workspace_members m WHERE m.workspace_id = w.id) AS member_count,
		       (SELECT count(*) FROM channels c WHERE c.workspace_id = w.id) AS channel_count,
		       p.code AS plan_code, s.status::text AS sub_status
		FROM workspaces w
		LEFT JOIN users ow ON ow.id = w.owner_id
		LEFT JOIN saas_subscriptions s ON s.workspace_id = w.id
		LEFT JOIN saas_plans p ON p.id = s.plan_id
		` + where + `
		ORDER BY w.created_at DESC
		LIMIT $` + itoa(len(args)-1) + ` OFFSET $` + itoa(len(args))
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminWorkspaceListItem{}
	for rows.Next() {
		var w models.AdminWorkspaceListItem
		if err := rows.Scan(
			&w.ID, &w.Name, &w.Slug, &w.SuspendedAt, &w.CreatedAt,
			&w.OwnerEmail, &w.MemberCount, &w.ChannelCount,
			&w.PlanCode, &w.SubscriptionStatus,
		); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}

// --- subscriptions -----------------------------------------------------

// ListSubscriptions returns all subscriptions joined with workspace + plan.
func (r *AdminRepository) ListSubscriptions(ctx context.Context, limit, offset int) ([]models.AdminSubscriptionListItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `
		SELECT s.id::text, s.workspace_id::text, w.name, p.code, p.name, p.price_idr,
		       s.status::text, s.current_period_end, s.created_at
		FROM saas_subscriptions s
		JOIN workspaces w ON w.id = s.workspace_id
		JOIN saas_plans p ON p.id = s.plan_id
		ORDER BY s.created_at DESC
		LIMIT $1 OFFSET $2`
	rows, err := r.db.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminSubscriptionListItem{}
	for rows.Next() {
		var s models.AdminSubscriptionListItem
		if err := rows.Scan(
			&s.ID, &s.WorkspaceID, &s.WorkspaceName, &s.PlanCode, &s.PlanName,
			&s.PriceIDR, &s.Status, &s.CurrentPeriodEnd, &s.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, s)
	}
	return out, rows.Err()
}

// --- channels ----------------------------------------------------------

// ListChannels returns all channels with workspace name + has_credentials.
// Credential material is NEVER selected here.
func (r *AdminRepository) ListChannels(ctx context.Context, limit, offset int) ([]models.AdminChannelListItem, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	const q = `
		SELECT c.id::text, c.workspace_id::text, w.name, c.type::text, c.name,
		       c.status::text, c.external_id,
		       EXISTS(SELECT 1 FROM channel_credentials cc WHERE cc.channel_id = c.id) AS has_creds,
		       c.last_connected_at, c.created_at
		FROM channels c
		JOIN workspaces w ON w.id = c.workspace_id
		ORDER BY c.created_at DESC
		LIMIT $1 OFFSET $2`
	rows, err := r.db.Query(ctx, q, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminChannelListItem{}
	for rows.Next() {
		var c models.AdminChannelListItem
		if err := rows.Scan(
			&c.ID, &c.WorkspaceID, &c.WorkspaceName, &c.Type, &c.Name,
			&c.Status, &c.ExternalID, &c.HasCredentials, &c.LastConnected, &c.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// --- audit logs --------------------------------------------------------

// CreateAuditLogParams holds inputs for an audit-log row.
type CreateAuditLogParams struct {
	ActorUserID *string
	ActorEmail  string
	Action      string
	TargetType  string
	TargetID    string
	Metadata    json.RawMessage
	IP          *string
}

// CreateAuditLog records one super-admin action.
func (r *AdminRepository) CreateAuditLog(ctx context.Context, p CreateAuditLogParams) error {
	if len(p.Metadata) == 0 {
		p.Metadata = json.RawMessage(`{}`)
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO admin_audit_logs
			(actor_user_id, actor_email, action, target_type, target_id, metadata, ip)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		p.ActorUserID, p.ActorEmail, p.Action, p.TargetType, p.TargetID, p.Metadata, p.IP)
	return err
}

// ListAuditLogs returns the most recent admin actions.
func (r *AdminRepository) ListAuditLogs(ctx context.Context, limit int) ([]models.AdminAuditLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	const q = `SELECT id::text, actor_user_id::text, actor_email, action,
		target_type, target_id, metadata, ip, created_at
		FROM admin_audit_logs ORDER BY created_at DESC LIMIT $1`
	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AdminAuditLog{}
	for rows.Next() {
		var l models.AdminAuditLog
		if err := rows.Scan(
			&l.ID, &l.ActorUserID, &l.ActorEmail, &l.Action,
			&l.TargetType, &l.TargetID, &l.Metadata, &l.IP, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// --- abuse reports -----------------------------------------------------

// ListAbuseReports returns reports, optionally filtered by status.
func (r *AdminRepository) ListAbuseReports(ctx context.Context, status string, limit int) ([]models.AbuseReport, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	args := []any{}
	where := ""
	if status != "" {
		args = append(args, status)
		where = `WHERE ar.status = $1`
	}
	args = append(args, limit)
	q := `
		SELECT ar.id::text, ar.workspace_id::text, w.name, ar.reporter_user_id::text,
		       ar.reporter_email, ar.category, ar.description, ar.status::text,
		       ar.resolution_note, ar.resolved_by::text, ar.resolved_at,
		       ar.created_at, ar.updated_at
		FROM abuse_reports ar
		LEFT JOIN workspaces w ON w.id = ar.workspace_id
		` + where + `
		ORDER BY ar.created_at DESC
		LIMIT $` + itoa(len(args))
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AbuseReport{}
	for rows.Next() {
		var a models.AbuseReport
		var st string
		if err := rows.Scan(
			&a.ID, &a.WorkspaceID, &a.WorkspaceName, &a.ReporterUserID,
			&a.ReporterEmail, &a.Category, &a.Description, &st,
			&a.ResolutionNote, &a.ResolvedBy, &a.ResolvedAt,
			&a.CreatedAt, &a.UpdatedAt,
		); err != nil {
			return nil, err
		}
		a.Status = models.AbuseStatus(st)
		out = append(out, a)
	}
	return out, rows.Err()
}

// GetAbuseReport fetches one report.
func (r *AdminRepository) GetAbuseReport(ctx context.Context, id string) (*models.AbuseReport, error) {
	const q = `SELECT ar.id::text, ar.workspace_id::text, w.name, ar.reporter_user_id::text,
		ar.reporter_email, ar.category, ar.description, ar.status::text,
		ar.resolution_note, ar.resolved_by::text, ar.resolved_at, ar.created_at, ar.updated_at
		FROM abuse_reports ar
		LEFT JOIN workspaces w ON w.id = ar.workspace_id
		WHERE ar.id = $1`
	var a models.AbuseReport
	var st string
	err := r.db.QueryRow(ctx, q, id).Scan(
		&a.ID, &a.WorkspaceID, &a.WorkspaceName, &a.ReporterUserID,
		&a.ReporterEmail, &a.Category, &a.Description, &st,
		&a.ResolutionNote, &a.ResolvedBy, &a.ResolvedAt, &a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	a.Status = models.AbuseStatus(st)
	return &a, nil
}

// UpdateAbuseStatus sets a report's status + resolution note + resolver.
func (r *AdminRepository) UpdateAbuseStatus(ctx context.Context, id, status string, note, resolvedBy *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE abuse_reports
		SET status = $2,
		    resolution_note = $3,
		    resolved_by = $4,
		    resolved_at = CASE WHEN $2 IN ('resolved','dismissed') THEN now() ELSE NULL END,
		    updated_at = now()
		WHERE id = $1`, id, status, note, resolvedBy)
	return err
}

// --- system logs -------------------------------------------------------

// CreateSystemLogParams holds inputs for a system-log row.
type CreateSystemLogParams struct {
	Level       string
	Source      string
	Message     string
	Context     json.RawMessage
	WorkspaceID *string
}

// CreateSystemLog inserts a system-log row.
func (r *AdminRepository) CreateSystemLog(ctx context.Context, p CreateSystemLogParams) error {
	if len(p.Context) == 0 {
		p.Context = json.RawMessage(`{}`)
	}
	if p.Level == "" {
		p.Level = "info"
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO system_logs (level, source, message, context, workspace_id)
		VALUES ($1, $2, $3, $4, $5)`,
		p.Level, p.Source, p.Message, p.Context, p.WorkspaceID)
	return err
}

// ListSystemLogs returns recent system logs, optionally filtered by level.
func (r *AdminRepository) ListSystemLogs(ctx context.Context, level string, limit int) ([]models.SystemLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	args := []any{}
	where := ""
	if level != "" {
		args = append(args, level)
		where = `WHERE level = $1`
	}
	args = append(args, limit)
	q := `SELECT id::text, level::text, source, message, context, workspace_id::text, created_at
		FROM system_logs ` + where + ` ORDER BY created_at DESC LIMIT $` + itoa(len(args))
	rows, err := r.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.SystemLog{}
	for rows.Next() {
		var l models.SystemLog
		var lvl string
		if err := rows.Scan(&l.ID, &lvl, &l.Source, &l.Message, &l.Context, &l.WorkspaceID, &l.CreatedAt); err != nil {
			return nil, err
		}
		l.Level = models.SystemLogLevel(lvl)
		out = append(out, l)
	}
	return out, rows.Err()
}

// --- webhook delivery logs (platform-wide) -----------------------------

// ListWebhookDeliveries returns recent webhook deliveries across all
// workspaces for the admin webhook-log viewer.
func (r *AdminRepository) ListWebhookDeliveries(ctx context.Context, limit int) ([]models.WebhookDeliveryLog, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	const q = `SELECT id::text, workspace_id::text, webhook_endpoint_id::text,
		event, payload, status_code, attempt, succeeded, response_body,
		error_message, duration_ms, created_at
		FROM webhook_delivery_logs ORDER BY created_at DESC LIMIT $1`
	rows, err := r.db.Query(ctx, q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.WebhookDeliveryLog{}
	for rows.Next() {
		var l models.WebhookDeliveryLog
		if err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.WebhookEndpointID, &l.Event, &l.Payload,
			&l.StatusCode, &l.Attempt, &l.Succeeded, &l.ResponseBody,
			&l.ErrorMessage, &l.DurationMs, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

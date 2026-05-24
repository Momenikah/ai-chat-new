package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Admin service errors.
var (
	ErrWorkspaceNotFound = errors.New("workspace not found")
	ErrReportNotFound    = errors.New("abuse report not found")
	ErrUserNotFound      = errors.New("user not found")
)

// AdminService implements the super-admin platform operations. Every
// mutating method records an entry to admin_audit_logs.
type AdminService struct {
	admin      *repositories.AdminRepository
	users      *repositories.UserRepository
	workspaces *repositories.WorkspaceRepository
}

// NewAdminService constructs an AdminService.
func NewAdminService(
	admin *repositories.AdminRepository,
	users *repositories.UserRepository,
	workspaces *repositories.WorkspaceRepository,
) *AdminService {
	return &AdminService{admin: admin, users: users, workspaces: workspaces}
}

// Actor identifies the super admin performing an action (for audit logs).
type Actor struct {
	UserID string
	Email  string
	IP     string
}

/* ------------------------------- reads -------------------------------- */

func (s *AdminService) Overview(ctx context.Context) (*models.PlatformOverview, error) {
	return s.admin.Overview(ctx)
}

func (s *AdminService) ListUsers(ctx context.Context, search string, limit, offset int) ([]models.AdminUserListItem, error) {
	return s.admin.ListUsers(ctx, search, limit, offset)
}

func (s *AdminService) ListWorkspaces(ctx context.Context, search string, limit, offset int) ([]models.AdminWorkspaceListItem, error) {
	return s.admin.ListWorkspaces(ctx, search, limit, offset)
}

func (s *AdminService) ListSubscriptions(ctx context.Context, limit, offset int) ([]models.AdminSubscriptionListItem, error) {
	return s.admin.ListSubscriptions(ctx, limit, offset)
}

func (s *AdminService) ListChannels(ctx context.Context, limit, offset int) ([]models.AdminChannelListItem, error) {
	return s.admin.ListChannels(ctx, limit, offset)
}

func (s *AdminService) ListSystemLogs(ctx context.Context, level string, limit int) ([]models.SystemLog, error) {
	return s.admin.ListSystemLogs(ctx, level, limit)
}

func (s *AdminService) ListWebhookDeliveries(ctx context.Context, limit int) ([]models.WebhookDeliveryLog, error) {
	return s.admin.ListWebhookDeliveries(ctx, limit)
}

func (s *AdminService) ListAuditLogs(ctx context.Context, limit int) ([]models.AdminAuditLog, error) {
	return s.admin.ListAuditLogs(ctx, limit)
}

func (s *AdminService) ListReports(ctx context.Context, status string, limit int) ([]models.AbuseReport, error) {
	return s.admin.ListAbuseReports(ctx, status, limit)
}

/* ------------------------------ actions ------------------------------- */

// SetWorkspaceSuspended suspends or un-suspends a workspace and audits it.
func (s *AdminService) SetWorkspaceSuspended(ctx context.Context, actor Actor, workspaceID string, suspended bool, reason string) (*models.Workspace, error) {
	ws, err := s.workspaces.GetByID(ctx, workspaceID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrWorkspaceNotFound
		}
		return nil, err
	}
	var reasonPtr *string
	if suspended && reason != "" {
		reasonPtr = &reason
	}
	if err := s.workspaces.SetSuspended(ctx, workspaceID, suspended, reasonPtr); err != nil {
		return nil, err
	}
	action := "workspace.unsuspend"
	if suspended {
		action = "workspace.suspend"
	}
	s.audit(ctx, actor, action, "workspace", workspaceID, map[string]any{
		"workspace_name": ws.Name,
		"reason":         reason,
	})
	return s.workspaces.GetByID(ctx, workspaceID)
}

// ResolveReport updates an abuse report's status + note and audits it.
func (s *AdminService) ResolveReport(ctx context.Context, actor Actor, reportID, status, note string) (*models.AbuseReport, error) {
	report, err := s.admin.GetAbuseReport(ctx, reportID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrReportNotFound
		}
		return nil, err
	}
	var notePtr *string
	if note != "" {
		notePtr = &note
	}
	resolvedBy := actor.UserID
	if err := s.admin.UpdateAbuseStatus(ctx, reportID, status, notePtr, &resolvedBy); err != nil {
		return nil, err
	}
	s.audit(ctx, actor, "report.update", "abuse_report", reportID, map[string]any{
		"status":   status,
		"previous": string(report.Status),
	})
	return s.admin.GetAbuseReport(ctx, reportID)
}

// ImpersonateResult is the placeholder impersonation payload. In production
// this would carry a short-lived, scoped impersonation token; here it is a
// non-functional placeholder so the flow + audit trail can be exercised
// safely.
type ImpersonateResult struct {
	TargetUserID   string `json:"target_user_id"`
	TargetEmail    string `json:"target_email"`
	Placeholder    bool   `json:"placeholder"`
	ImpersonateRef string `json:"impersonate_ref"`
	Note           string `json:"note"`
}

// Impersonate records an audit log and returns a PLACEHOLDER reference. It
// deliberately does NOT mint a working session — impersonation is a
// sensitive capability and is stubbed pending a scoped-token design.
func (s *AdminService) Impersonate(ctx context.Context, actor Actor, targetUserID string) (*ImpersonateResult, error) {
	target, err := s.users.GetByID(ctx, targetUserID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrUserNotFound
		}
		return nil, err
	}
	ref := "imp_" + targetUserID
	s.audit(ctx, actor, "user.impersonate", "user", targetUserID, map[string]any{
		"target_email": target.Email,
		"placeholder":  true,
	})
	return &ImpersonateResult{
		TargetUserID:   target.ID,
		TargetEmail:    target.Email,
		Placeholder:    true,
		ImpersonateRef: ref,
		Note:           "Placeholder — production akan menerbitkan token impersonasi berlingkup terbatas. Aksi ini sudah tercatat di audit log.",
	}, nil
}

/* ------------------------------- audit -------------------------------- */

// audit records one admin action. Best-effort: a logging failure must not
// fail the underlying operation.
func (s *AdminService) audit(ctx context.Context, actor Actor, action, targetType, targetID string, metadata map[string]any) {
	var raw json.RawMessage
	if len(metadata) > 0 {
		if b, err := json.Marshal(metadata); err == nil {
			raw = b
		}
	}
	var actorID *string
	if actor.UserID != "" {
		id := actor.UserID
		actorID = &id
	}
	var ip *string
	if actor.IP != "" {
		v := actor.IP
		ip = &v
	}
	_ = s.admin.CreateAuditLog(ctx, repositories.CreateAuditLogParams{
		ActorUserID: actorID,
		ActorEmail:  actor.Email,
		Action:      action,
		TargetType:  targetType,
		TargetID:    targetID,
		Metadata:    raw,
		IP:          ip,
	})
}

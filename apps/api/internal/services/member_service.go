package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Member-related service errors.
var (
	ErrAlreadyMember     = errors.New("user is already a workspace member")
	ErrInvitationExists  = errors.New("a pending invitation already exists")
	ErrMemberNotFound    = errors.New("member not found")
	ErrCannotRemoveOwner = errors.New("the workspace owner cannot be removed")
)

const invitationTTL = 7 * 24 * time.Hour

// MemberService implements team-member management and invitations.
type MemberService struct {
	pool        *pgxpool.Pool
	users       *repositories.UserRepository
	members     *repositories.WorkspaceMemberRepository
	invitations *repositories.InvitationRepository
	plan        PlanEnforcer
}

// NewMemberService constructs a MemberService.
func NewMemberService(
	pool *pgxpool.Pool,
	users *repositories.UserRepository,
	members *repositories.WorkspaceMemberRepository,
	invitations *repositories.InvitationRepository,
) *MemberService {
	return &MemberService{pool: pool, users: users, members: members, invitations: invitations}
}

// SetPlanEnforcer wires plan-limit enforcement. Optional (nil = no limits).
func (s *MemberService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// TeamListing is the combined member + pending-invitation view.
type TeamListing struct {
	Members     []models.MemberWithUser     `json:"members"`
	Invitations []models.WorkspaceInvitation `json:"invitations"`
}

// List returns members and pending invitations of a workspace.
func (s *MemberService) List(ctx context.Context, workspaceID string) (*TeamListing, error) {
	members, err := s.members.List(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	invitations, err := s.invitations.ListPending(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	return &TeamListing{Members: members, Invitations: invitations}, nil
}

// InviteResult describes the outcome of an invitation.
type InviteResult struct {
	Invitation *models.WorkspaceInvitation `json:"invitation"`
	// AutoJoined is true when the invited email already had an account and
	// was therefore added to the workspace immediately.
	AutoJoined bool `json:"auto_joined"`
}

// Invite invites an email to join a workspace with the given role.
//
// If the email already has an account, the user is added to the workspace
// straight away (the invitation is recorded as accepted). Otherwise a
// pending invitation is created for them to accept after registering.
func (s *MemberService) Invite(ctx context.Context, workspaceID, invitedBy, email string, role models.MemberRole) (*InviteResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	// Reject if already an active member.
	if existingUser, err := s.users.GetByEmail(ctx, email); err == nil {
		if _, mErr := s.members.Get(ctx, workspaceID, existingUser.ID); mErr == nil {
			return nil, ErrAlreadyMember
		} else if !errors.Is(mErr, repositories.ErrNotFound) {
			return nil, mErr
		}
	} else if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}

	// Reject duplicate pending invitations.
	if _, err := s.invitations.GetPending(ctx, workspaceID, email); err == nil {
		return nil, ErrInvitationExists
	} else if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}

	// Enforce the plan's team-member seat limit.
	current, err := s.members.Count(ctx, workspaceID)
	if err != nil {
		return nil, err
	}
	if err := ensureCanAdd(s.plan, ctx, workspaceID, ResourceTeamMembers, current); err != nil {
		return nil, err
	}

	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	invRepo := s.invitations.WithTx(tx)
	invitation, err := invRepo.Create(ctx, repositories.CreateInvitationParams{
		WorkspaceID: workspaceID,
		Email:       email,
		Role:        role,
		Token:       token,
		InvitedBy:   invitedBy,
		ExpiresAt:   time.Now().Add(invitationTTL),
	})
	if err != nil {
		return nil, err
	}

	autoJoined := false
	if user, err := s.users.GetByEmail(ctx, email); err == nil {
		now := time.Now()
		invitedByCopy := invitedBy
		if _, err := s.members.WithTx(tx).Add(ctx, repositories.AddMemberParams{
			WorkspaceID: workspaceID,
			UserID:      user.ID,
			Role:        role,
			Status:      models.MemberActive,
			InvitedBy:   &invitedByCopy,
			JoinedAt:    &now,
		}); err != nil {
			return nil, err
		}
		if err := invRepo.MarkAccepted(ctx, invitation.ID); err != nil {
			return nil, err
		}
		invitation.Status = models.InvitationAccepted
		autoJoined = true
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &InviteResult{Invitation: invitation, AutoJoined: autoJoined}, nil
}

// RemoveMember removes a membership from a workspace. The OWNER cannot be
// removed.
func (s *MemberService) RemoveMember(ctx context.Context, workspaceID, memberID string) error {
	member, err := s.members.GetByID(ctx, memberID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return ErrMemberNotFound
		}
		return err
	}
	if member.WorkspaceID != workspaceID {
		return ErrMemberNotFound
	}
	if member.Role == models.RoleOwner {
		return ErrCannotRemoveOwner
	}
	return s.members.Delete(ctx, memberID, workspaceID)
}

func randomToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

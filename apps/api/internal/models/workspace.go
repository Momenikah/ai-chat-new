package models

import "time"

// MemberRole enumerates a user's access level *within a workspace*.
type MemberRole string

const (
	RoleOwner  MemberRole = "OWNER"
	RoleAdmin  MemberRole = "ADMIN"
	RoleAgent  MemberRole = "AGENT"
	RoleViewer MemberRole = "VIEWER"
)

var roleWeight = map[MemberRole]int{
	RoleOwner:  80,
	RoleAdmin:  60,
	RoleAgent:  40,
	RoleViewer: 20,
}

// Valid reports whether r is a known role.
func (r MemberRole) Valid() bool {
	_, ok := roleWeight[r]
	return ok
}

// AtLeast reports whether r has at least the privilege of minimum.
func (r MemberRole) AtLeast(minimum MemberRole) bool {
	return roleWeight[r] >= roleWeight[minimum]
}

// MemberStatus is the lifecycle state of a workspace membership.
type MemberStatus string

const (
	MemberActive    MemberStatus = "active"
	MemberInvited   MemberStatus = "invited"
	MemberSuspended MemberStatus = "suspended"
)

// InvitationStatus is the lifecycle state of an invitation.
type InvitationStatus string

const (
	InvitationPending  InvitationStatus = "pending"
	InvitationAccepted InvitationStatus = "accepted"
	InvitationRevoked  InvitationStatus = "revoked"
	InvitationExpired  InvitationStatus = "expired"
)

// Workspace is a tenant: one business, with its own members and channels.
type Workspace struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Slug             string     `json:"slug"`
	LogoURL          *string    `json:"logo_url"`
	BrandColor       string     `json:"brand_color"`
	Timezone         string     `json:"timezone"`
	OwnerID          *string    `json:"owner_id"`
	SuspendedAt      *time.Time `json:"suspended_at"`
	SuspensionReason *string    `json:"suspension_reason"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
}

// IsSuspended reports whether the workspace is currently suspended.
func (w *Workspace) IsSuspended() bool { return w.SuspendedAt != nil }

// WorkspaceMember links a user to a workspace with a role.
type WorkspaceMember struct {
	ID          string       `json:"id"`
	WorkspaceID string       `json:"workspace_id"`
	UserID      string       `json:"user_id"`
	Role        MemberRole   `json:"role"`
	Status      MemberStatus `json:"status"`
	InvitedBy   *string      `json:"invited_by"`
	JoinedAt    *time.Time   `json:"joined_at"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

// MemberWithUser is a member row enriched with the user's profile, used by
// the team-members listing.
type MemberWithUser struct {
	WorkspaceMember
	UserName      string  `json:"user_name"`
	UserEmail     string  `json:"user_email"`
	UserAvatarURL *string `json:"user_avatar_url"`
}

// WorkspaceWithRole is a workspace plus the requesting user's role in it.
type WorkspaceWithRole struct {
	Workspace
	MemberRole MemberRole `json:"member_role"`
}

// WorkspaceInvitation is a pending invite to join a workspace.
type WorkspaceInvitation struct {
	ID          string           `json:"id"`
	WorkspaceID string           `json:"workspace_id"`
	Email       string           `json:"email"`
	Role        MemberRole       `json:"role"`
	Token       string           `json:"token"`
	Status      InvitationStatus `json:"status"`
	InvitedBy   *string          `json:"invited_by"`
	ExpiresAt   time.Time        `json:"expires_at"`
	AcceptedAt  *time.Time       `json:"accepted_at"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

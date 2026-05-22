package services

import (
	"context"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// WorkspaceService implements workspace CRUD and branding.
type WorkspaceService struct {
	pool       *pgxpool.Pool
	workspaces *repositories.WorkspaceRepository
	members    *repositories.WorkspaceMemberRepository
}

// NewWorkspaceService constructs a WorkspaceService.
func NewWorkspaceService(
	pool *pgxpool.Pool,
	workspaces *repositories.WorkspaceRepository,
	members *repositories.WorkspaceMemberRepository,
) *WorkspaceService {
	return &WorkspaceService{pool: pool, workspaces: workspaces, members: members}
}

// CreateWorkspaceInput is the payload for creating a workspace.
type CreateWorkspaceInput struct {
	Name       string
	BrandColor string
	Timezone   string
}

// Create makes a new workspace and adds the caller as its OWNER.
func (s *WorkspaceService) Create(ctx context.Context, userID string, in CreateWorkspaceInput) (*models.WorkspaceWithRole, error) {
	slug, err := uniqueSlug(ctx, s.workspaces, in.Name)
	if err != nil {
		return nil, err
	}
	if in.BrandColor == "" {
		in.BrandColor = "#18181b"
	}
	if in.Timezone == "" {
		in.Timezone = "Asia/Jakarta"
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	workspace, err := s.workspaces.WithTx(tx).Create(ctx, repositories.CreateWorkspaceParams{
		Name:       strings.TrimSpace(in.Name),
		Slug:       slug,
		OwnerID:    userID,
		BrandColor: in.BrandColor,
		Timezone:   in.Timezone,
	})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if _, err := s.members.WithTx(tx).Add(ctx, repositories.AddMemberParams{
		WorkspaceID: workspace.ID,
		UserID:      userID,
		Role:        models.RoleOwner,
		Status:      models.MemberActive,
		JoinedAt:    &now,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &models.WorkspaceWithRole{Workspace: *workspace, MemberRole: models.RoleOwner}, nil
}

// ListForUser returns the workspaces the user belongs to.
func (s *WorkspaceService) ListForUser(ctx context.Context, userID string) ([]models.WorkspaceWithRole, error) {
	return s.workspaces.ListForUser(ctx, userID)
}

// Get returns a workspace by id (membership is checked by middleware).
func (s *WorkspaceService) Get(ctx context.Context, workspaceID string) (*models.Workspace, error) {
	return s.workspaces.GetByID(ctx, workspaceID)
}

// UpdateWorkspaceInput is the payload for editing workspace branding.
type UpdateWorkspaceInput struct {
	Name       string
	LogoURL    *string
	BrandColor string
	Timezone   string
}

// Update saves the editable workspace/branding fields.
func (s *WorkspaceService) Update(ctx context.Context, workspaceID string, in UpdateWorkspaceInput) (*models.Workspace, error) {
	current, err := s.workspaces.GetByID(ctx, workspaceID)
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = current.Name
	}
	brandColor := in.BrandColor
	if brandColor == "" {
		brandColor = current.BrandColor
	}
	timezone := in.Timezone
	if timezone == "" {
		timezone = current.Timezone
	}

	return s.workspaces.Update(ctx, repositories.UpdateWorkspaceParams{
		ID:         workspaceID,
		Name:       name,
		LogoURL:    in.LogoURL,
		BrandColor: brandColor,
		Timezone:   timezone,
	})
}

// Delete permanently removes a workspace and all its data.
func (s *WorkspaceService) Delete(ctx context.Context, workspaceID string) error {
	return s.workspaces.Delete(ctx, workspaceID)
}

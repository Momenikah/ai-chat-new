package services

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/auth"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Service-level errors surfaced to handlers.
var (
	ErrEmailTaken         = errors.New("email already registered")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrInvalidRefresh     = errors.New("invalid or expired refresh token")
	ErrUserInactive       = errors.New("user account is inactive")
)

// AuthResult bundles a user with freshly issued tokens.
type AuthResult struct {
	User         *models.User `json:"user"`
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresIn    int          `json:"expires_in"`
}

// RegisterInput is the payload for creating a new user + first workspace.
type RegisterInput struct {
	WorkspaceName string
	Name          string
	Email         string
	Password      string
}

// AuthService implements registration, login, token refresh and logout.
type AuthService struct {
	pool       *pgxpool.Pool
	users      *repositories.UserRepository
	workspaces *repositories.WorkspaceRepository
	members    *repositories.WorkspaceMemberRepository
	tokens     *repositories.RefreshTokenRepository
	tm         *auth.TokenManager
}

// NewAuthService constructs an AuthService.
func NewAuthService(
	pool *pgxpool.Pool,
	users *repositories.UserRepository,
	workspaces *repositories.WorkspaceRepository,
	members *repositories.WorkspaceMemberRepository,
	tokens *repositories.RefreshTokenRepository,
	tm *auth.TokenManager,
) *AuthService {
	return &AuthService{
		pool: pool, users: users, workspaces: workspaces,
		members: members, tokens: tokens, tm: tm,
	}
}

// Register creates a user, their first workspace, and an OWNER membership
// — all atomically.
func (s *AuthService) Register(ctx context.Context, in RegisterInput) (*AuthResult, error) {
	in.Email = strings.ToLower(strings.TrimSpace(in.Email))

	exists, err := s.users.EmailExists(ctx, in.Email)
	if err != nil {
		return nil, err
	}
	if exists {
		return nil, ErrEmailTaken
	}

	passwordHash, err := auth.HashPassword(in.Password)
	if err != nil {
		return nil, err
	}

	slug, err := s.uniqueSlug(ctx, in.WorkspaceName)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	user, err := s.users.WithTx(tx).Create(ctx, repositories.CreateUserParams{
		Name:         in.Name,
		Email:        in.Email,
		PasswordHash: passwordHash,
	})
	if err != nil {
		return nil, err
	}

	workspace, err := s.workspaces.WithTx(tx).Create(ctx, repositories.CreateWorkspaceParams{
		Name:       in.WorkspaceName,
		Slug:       slug,
		OwnerID:    user.ID,
		BrandColor: "#18181b",
		Timezone:   "Asia/Jakarta",
	})
	if err != nil {
		return nil, err
	}

	now := time.Now()
	if _, err := s.members.WithTx(tx).Add(ctx, repositories.AddMemberParams{
		WorkspaceID: workspace.ID,
		UserID:      user.ID,
		Role:        models.RoleOwner,
		Status:      models.MemberActive,
		JoinedAt:    &now,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.issueTokens(ctx, user)
}

// Login verifies credentials and issues tokens.
func (s *AuthService) Login(ctx context.Context, email, password string) (*AuthResult, error) {
	user, err := s.users.GetByEmail(ctx, strings.TrimSpace(email))
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrInvalidCredentials
		}
		return nil, err
	}
	if !auth.CheckPassword(user.PasswordHash, password) {
		return nil, ErrInvalidCredentials
	}
	if !user.IsActive {
		return nil, ErrUserInactive
	}
	if err := s.users.TouchLastLogin(ctx, user.ID); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, user)
}

// Refresh rotates a refresh token and issues a fresh pair.
func (s *AuthService) Refresh(ctx context.Context, refreshToken string) (*AuthResult, error) {
	hash := auth.HashRefreshToken(refreshToken)

	stored, err := s.tokens.GetValidByHash(ctx, hash)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrInvalidRefresh
		}
		return nil, err
	}
	user, err := s.users.GetByID(ctx, stored.UserID)
	if err != nil {
		return nil, ErrInvalidRefresh
	}
	if !user.IsActive {
		return nil, ErrUserInactive
	}
	if err := s.tokens.Revoke(ctx, hash); err != nil {
		return nil, err
	}
	return s.issueTokens(ctx, user)
}

// Logout revokes the supplied refresh token. Missing tokens are ignored.
func (s *AuthService) Logout(ctx context.Context, refreshToken string) error {
	if refreshToken == "" {
		return nil
	}
	return s.tokens.Revoke(ctx, auth.HashRefreshToken(refreshToken))
}

// Me returns the user identified by id.
func (s *AuthService) Me(ctx context.Context, userID string) (*models.User, error) {
	return s.users.GetByID(ctx, userID)
}

func (s *AuthService) issueTokens(ctx context.Context, user *models.User) (*AuthResult, error) {
	accessToken, err := s.tm.GenerateAccessToken(user.ID, user.Email)
	if err != nil {
		return nil, err
	}
	refreshToken, err := auth.GenerateRefreshToken()
	if err != nil {
		return nil, err
	}
	expiresAt := time.Now().Add(s.tm.RefreshTTL())
	if err := s.tokens.Create(ctx, user.ID, auth.HashRefreshToken(refreshToken), expiresAt); err != nil {
		return nil, err
	}
	return &AuthResult{
		User:         user,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.tm.AccessTTL().Seconds()),
	}, nil
}

var slugInvalid = regexp.MustCompile(`[^a-z0-9]+`)

// uniqueSlug derives a URL-safe slug from a name and guarantees uniqueness.
func (s *AuthService) uniqueSlug(ctx context.Context, name string) (string, error) {
	return uniqueSlug(ctx, s.workspaces, name)
}

// uniqueSlug is shared by AuthService and WorkspaceService.
func uniqueSlug(ctx context.Context, repo *repositories.WorkspaceRepository, name string) (string, error) {
	base := strings.Trim(slugInvalid.ReplaceAllString(strings.ToLower(strings.TrimSpace(name)), "-"), "-")
	if base == "" {
		base = "workspace"
	}
	candidate := base
	for i := 0; i < 5; i++ {
		taken, err := repo.SlugExists(ctx, candidate)
		if err != nil {
			return "", err
		}
		if !taken {
			return candidate, nil
		}
		candidate = base + "-" + randomSuffix()
	}
	return base + "-" + randomSuffix(), nil
}

func randomSuffix() string {
	b := make([]byte, 3)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

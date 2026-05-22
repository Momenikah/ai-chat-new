package services

import (
	"context"
	"errors"
	"strings"

	"github.com/aichat/api/internal/apikey"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// API-key service errors.
var (
	ErrAPIKeyNotFound = errors.New("api key not found")
)

// APIKeyService implements developer API-key management.
type APIKeyService struct {
	keys *repositories.APIKeyRepository
	plan PlanEnforcer
}

// NewAPIKeyService constructs an APIKeyService.
func NewAPIKeyService(repo *repositories.APIKeyRepository) *APIKeyService {
	return &APIKeyService{keys: repo}
}

// SetPlanEnforcer wires plan-feature enforcement. Optional (nil = allow).
func (s *APIKeyService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// CreatedAPIKey bundles the persisted key with its one-time plaintext.
type CreatedAPIKey struct {
	Key       *models.APIKey `json:"key"`
	Plaintext string         `json:"plaintext"` // shown exactly once
}

// CreateAPIKeyInput is the payload for minting a key.
type CreateAPIKeyInput struct {
	WorkspaceID string
	ActorID     string
	Name        string
	Scopes      []string
}

// Create mints, hashes and persists a new key, returning the plaintext
// exactly once. The plaintext is never recoverable afterwards.
func (s *APIKeyService) Create(ctx context.Context, in CreateAPIKeyInput) (*CreatedAPIKey, error) {
	// API access is a gated feature (BASIC plan and above).
	if err := ensureFeature(s.plan, ctx, in.WorkspaceID, FeatureAPIAccess); err != nil {
		return nil, err
	}
	name := strings.TrimSpace(in.Name)
	if name == "" {
		name = "API Key"
	}
	gen, err := apikey.Generate()
	if err != nil {
		return nil, err
	}
	actor := in.ActorID
	key, err := s.keys.Create(ctx, repositories.CreateAPIKeyParams{
		WorkspaceID: in.WorkspaceID,
		Name:        name,
		Prefix:      gen.Prefix,
		KeyHash:     gen.Hash,
		Scopes:      in.Scopes,
		CreatedBy:   &actor,
	})
	if err != nil {
		return nil, err
	}
	return &CreatedAPIKey{Key: key, Plaintext: gen.Plaintext}, nil
}

// List returns all keys (active + revoked) of a workspace.
func (s *APIKeyService) List(ctx context.Context, workspaceID string) ([]models.APIKey, error) {
	return s.keys.ListByWorkspace(ctx, workspaceID)
}

// Get returns one key by id.
func (s *APIKeyService) Get(ctx context.Context, id string) (*models.APIKey, error) {
	key, err := s.keys.GetByID(ctx, id)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrAPIKeyNotFound
		}
		return nil, err
	}
	return key, nil
}

// Revoke disables a key. Idempotent.
func (s *APIKeyService) Revoke(ctx context.Context, id string) error {
	return s.keys.Revoke(ctx, id)
}

// UsageLogs returns recent public-API requests for the workspace.
func (s *APIKeyService) UsageLogs(ctx context.Context, workspaceID string, limit int) ([]models.APIUsageLog, error) {
	return s.keys.ListUsageLogs(ctx, workspaceID, limit)
}

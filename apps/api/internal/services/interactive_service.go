package services

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Interactive-message service errors.
var (
	ErrInvalidInteractiveKind = errors.New("invalid interactive message kind")
	ErrEmptyInteractiveName   = errors.New("interactive message name must not be empty")
)

// InteractiveService implements CRUD for interactive payloads.
type InteractiveService struct {
	repo *repositories.InteractiveRepository
}

// NewInteractiveService constructs an InteractiveService.
func NewInteractiveService(repo *repositories.InteractiveRepository) *InteractiveService {
	return &InteractiveService{repo: repo}
}

// CreateInteractiveInput is the payload for creating an interactive message.
type CreateInteractiveInput struct {
	WorkspaceID string
	ActorID     string
	Name        string
	Kind        string
	Payload     json.RawMessage
}

// Create inserts an interactive message after validating the kind.
func (s *InteractiveService) Create(ctx context.Context, in CreateInteractiveInput) (*models.InteractiveMessage, error) {
	name := strings.TrimSpace(in.Name)
	if name == "" {
		return nil, ErrEmptyInteractiveName
	}
	if !models.ValidInteractiveKind(in.Kind) {
		return nil, ErrInvalidInteractiveKind
	}
	actor := in.ActorID
	return s.repo.Create(ctx, repositories.CreateInteractiveParams{
		WorkspaceID: in.WorkspaceID,
		Name:        name,
		Kind:        in.Kind,
		Payload:     in.Payload,
		CreatedBy:   &actor,
	})
}

// List returns interactive messages of a workspace.
func (s *InteractiveService) List(ctx context.Context, workspaceID string) ([]models.InteractiveMessage, error) {
	return s.repo.ListByWorkspace(ctx, workspaceID)
}

// Get fetches one interactive message.
func (s *InteractiveService) Get(ctx context.Context, id string) (*models.InteractiveMessage, error) {
	return s.repo.GetByID(ctx, id)
}

// Update saves the editable fields.
func (s *InteractiveService) Update(ctx context.Context, id, name string, payload json.RawMessage) (*models.InteractiveMessage, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrEmptyInteractiveName
	}
	return s.repo.Update(ctx, id, name, payload)
}

// Delete removes an interactive message.
func (s *InteractiveService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

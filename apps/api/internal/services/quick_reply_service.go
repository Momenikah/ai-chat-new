package services

import (
	"context"
	"errors"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// ErrEmptyQuickReply is returned for an empty shortcut/body pair.
var ErrEmptyQuickReply = errors.New("shortcut and body must not be empty")

// QuickReplyService implements quick-reply CRUD.
type QuickReplyService struct {
	replies *repositories.QuickReplyRepository
}

// NewQuickReplyService constructs a QuickReplyService.
func NewQuickReplyService(replies *repositories.QuickReplyRepository) *QuickReplyService {
	return &QuickReplyService{replies: replies}
}

// CreateQuickReplyInput is the payload for creating a quick reply.
type CreateQuickReplyInput struct {
	WorkspaceID string
	ActorID     string
	Shortcut    string
	Body        string
}

// Create inserts a quick reply.
func (s *QuickReplyService) Create(ctx context.Context, in CreateQuickReplyInput) (*models.QuickReply, error) {
	shortcut := strings.TrimSpace(in.Shortcut)
	body := strings.TrimSpace(in.Body)
	if shortcut == "" || body == "" {
		return nil, ErrEmptyQuickReply
	}
	creator := in.ActorID
	return s.replies.Create(ctx, repositories.CreateQuickReplyParams{
		WorkspaceID: in.WorkspaceID,
		Shortcut:    shortcut,
		Body:        body,
		CreatedBy:   &creator,
	})
}

// List returns the quick replies of a workspace.
func (s *QuickReplyService) List(ctx context.Context, workspaceID string) ([]models.QuickReply, error) {
	return s.replies.ListByWorkspace(ctx, workspaceID)
}

// Update saves the editable fields.
func (s *QuickReplyService) Update(ctx context.Context, id, shortcut, body string) (*models.QuickReply, error) {
	shortcut = strings.TrimSpace(shortcut)
	body = strings.TrimSpace(body)
	if shortcut == "" || body == "" {
		return nil, ErrEmptyQuickReply
	}
	return s.replies.Update(ctx, id, shortcut, body)
}

// Delete removes a quick reply.
func (s *QuickReplyService) Delete(ctx context.Context, id string) error {
	return s.replies.Delete(ctx, id)
}

// Get fetches a quick reply by id.
func (s *QuickReplyService) Get(ctx context.Context, id string) (*models.QuickReply, error) {
	return s.replies.GetByID(ctx, id)
}

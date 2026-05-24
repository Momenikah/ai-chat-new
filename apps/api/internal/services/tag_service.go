package services

import (
	"context"
	"errors"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Tag-related errors.
var ErrEmptyTagName = errors.New("tag name must not be empty")

// TagService implements tag CRUD and attach/detach to contacts.
type TagService struct {
	tags     *repositories.TagRepository
	contacts *repositories.ContactRepository
}

// NewTagService constructs a TagService.
func NewTagService(tags *repositories.TagRepository, contacts *repositories.ContactRepository) *TagService {
	return &TagService{tags: tags, contacts: contacts}
}

// List returns tags of a workspace.
func (s *TagService) List(ctx context.Context, workspaceID string) ([]models.Tag, error) {
	return s.tags.ListByWorkspace(ctx, workspaceID)
}

// Create inserts a tag.
func (s *TagService) Create(ctx context.Context, workspaceID, name, color string) (*models.Tag, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, ErrEmptyTagName
	}
	if color == "" {
		color = "#71717a"
	}
	return s.tags.Create(ctx, workspaceID, name, color)
}

// Delete removes a tag.
func (s *TagService) Delete(ctx context.Context, id, workspaceID string) error {
	return s.tags.Delete(ctx, id, workspaceID)
}

// Attach links a tag to a contact.
func (s *TagService) Attach(ctx context.Context, contactID, tagID string) error {
	return s.contacts.AttachTag(ctx, contactID, tagID)
}

// Detach unlinks a tag from a contact.
func (s *TagService) Detach(ctx context.Context, contactID, tagID string) error {
	return s.contacts.DetachTag(ctx, contactID, tagID)
}

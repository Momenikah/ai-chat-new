package services

import (
	"context"
	"errors"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/webhook"
)

// Conversation-related service errors.
var (
	ErrConversationNotFound = errors.New("conversation not found")
	ErrInvalidStatus        = errors.New("invalid conversation status")
)

// ConversationDetail bundles a conversation with its contact + tags so the
// inbox right-panel can render in one round-trip.
type ConversationDetail struct {
	Conversation *models.Conversation `json:"conversation"`
	Contact      *models.Contact      `json:"contact"`
	Tags         []models.Tag         `json:"tags"`
}

// ConversationService implements inbox conversation operations.
type ConversationService struct {
	conversations *repositories.ConversationRepository
	contacts      *repositories.ContactRepository
	broadcaster   realtime.Broadcaster
	webhooks      webhook.Dispatcher
}

// NewConversationService constructs a ConversationService.
func NewConversationService(
	conversations *repositories.ConversationRepository,
	contacts *repositories.ContactRepository,
	broadcaster realtime.Broadcaster,
) *ConversationService {
	return &ConversationService{
		conversations: conversations, contacts: contacts, broadcaster: broadcaster,
		webhooks: webhook.NoopDispatcher{},
	}
}

// SetWebhookDispatcher wires outbound webhook emission. Optional.
func (s *ConversationService) SetWebhookDispatcher(d webhook.Dispatcher) {
	if d != nil {
		s.webhooks = d
	}
}

// List returns the inbox conversation feed for a workspace.
func (s *ConversationService) List(ctx context.Context, workspaceID string) ([]models.ConversationListItem, error) {
	return s.conversations.ListByWorkspace(ctx, workspaceID)
}

// Get returns a conversation enriched with its contact + tags.
func (s *ConversationService) Get(ctx context.Context, conversationID string) (*ConversationDetail, error) {
	conv, err := s.conversations.GetByID(ctx, conversationID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrConversationNotFound
		}
		return nil, err
	}
	contact, err := s.contacts.GetByID(ctx, conv.ContactID)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	tags, err := s.contacts.ListTags(ctx, conv.ContactID)
	if err != nil {
		return nil, err
	}
	return &ConversationDetail{Conversation: conv, Contact: contact, Tags: tags}, nil
}

// UpdateStatus changes the conversation status and broadcasts the update.
func (s *ConversationService) UpdateStatus(ctx context.Context, conversationID string, status models.ConversationStatus) (*models.Conversation, error) {
	if !status.Valid() {
		return nil, ErrInvalidStatus
	}
	conv, err := s.conversations.UpdateStatus(ctx, conversationID, status)
	if err != nil {
		return nil, err
	}
	s.broadcast(conv, realtime.EventConversationUpdated)
	if status == models.ConvResolved {
		s.webhooks.Emit(conv.WorkspaceID, webhook.EventConversationResolved, conv)
	}
	return conv, nil
}

// Assign sets the assigned agent and records an audit-log row.
func (s *ConversationService) Assign(ctx context.Context, conversationID string, agentID *string, byUserID string) (*models.Conversation, error) {
	conv, err := s.conversations.Assign(ctx, conversationID, agentID)
	if err != nil {
		return nil, err
	}
	_ = s.conversations.RecordAssignment(ctx, conversationID, agentID, &byUserID)
	s.broadcast(conv, realtime.EventConversationAssigned)
	return conv, nil
}

// ResetUnread zeroes the unread counter (used when an agent opens the thread).
func (s *ConversationService) ResetUnread(ctx context.Context, conversationID string) error {
	if err := s.conversations.ResetUnread(ctx, conversationID); err != nil {
		return err
	}
	if conv, err := s.conversations.GetByID(ctx, conversationID); err == nil {
		s.broadcast(conv, realtime.EventConversationUpdated)
	}
	return nil
}

func (s *ConversationService) broadcast(conv *models.Conversation, t string) {
	if s.broadcaster == nil {
		return
	}
	s.broadcaster.Broadcast(conv.WorkspaceID, realtime.Event{
		Type:    t,
		Payload: conv,
	})
}

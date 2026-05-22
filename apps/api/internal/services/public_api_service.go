package services

import (
	"context"
	"errors"
	"strings"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Public-API service errors.
var (
	ErrPublicForbidden   = errors.New("resource does not belong to this workspace")
	ErrChannelRequired   = errors.New("channel_id is required when conversation_id is omitted")
	ErrRecipientRequired = errors.New("`to` is required when conversation_id is omitted")
	ErrNoDeliverer       = errors.New("channel type has no outbound deliverer")
)

// PublicAPIService backs the developer (API-key authenticated) endpoints.
// Every method is workspace-scoped and re-verifies tenant ownership of any
// resource resolved by id, so a leaked id from one workspace can never be
// used against another.
type PublicAPIService struct {
	channels      *repositories.ChannelRepository
	contacts      *repositories.ContactRepository
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	contactSvc    *ContactService
	templateSvc   *TemplateService
	deliverers    map[models.ChannelType]ChannelDeliverer
	plan          PlanEnforcer
}

// SetPlanEnforcer wires plan-based message-history retention. Optional.
func (s *PublicAPIService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// NewPublicAPIService constructs a PublicAPIService.
func NewPublicAPIService(
	channels *repositories.ChannelRepository,
	contacts *repositories.ContactRepository,
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	contactSvc *ContactService,
	templateSvc *TemplateService,
	deliverers map[models.ChannelType]ChannelDeliverer,
) *PublicAPIService {
	if deliverers == nil {
		deliverers = map[models.ChannelType]ChannelDeliverer{}
	}
	return &PublicAPIService{
		channels: channels, contacts: contacts, conversations: conversations,
		messages: messages, contactSvc: contactSvc, templateSvc: templateSvc,
		deliverers: deliverers,
	}
}

// SendMessageInput is the payload for POST /api/v1/messages/send.
type SendMessageInput struct {
	WorkspaceID    string
	ConversationID string // optional — reply on an existing thread
	ChannelID      string // required when ConversationID empty
	To             string // recipient external id (phone/PSID) when starting fresh
	Body           string
}

// SendMessage delivers a free-form text message. Either ConversationID is
// supplied (reply on a thread) or ChannelID+To (start/continue a thread by
// recipient). Bot-style send: SenderUserID is left empty so the deliverer's
// member guard is bypassed (the API key already authorises the workspace).
func (s *PublicAPIService) SendMessage(ctx context.Context, in SendMessageInput) (*models.Message, error) {
	body := strings.TrimSpace(in.Body)
	if body == "" {
		return nil, ErrEmptyMessage
	}
	conv, deliverer, err := s.resolveTarget(ctx, in.WorkspaceID, in.ConversationID, in.ChannelID, in.To)
	if err != nil {
		return nil, err
	}
	return deliverer.Deliver(ctx, DeliverInput{
		ChannelID:      conv.ChannelID,
		ConversationID: conv.ID,
		Body:           body,
	})
}

// SendTemplateInput is the payload for POST /api/v1/messages/template.
type SendTemplateInput struct {
	WorkspaceID    string
	ConversationID string
	ChannelID      string
	To             string
	TemplateID     string
	Variables      map[string]string
}

// SendTemplate renders an approved template then delivers it like a normal
// outbound message.
func (s *PublicAPIService) SendTemplate(ctx context.Context, in SendTemplateInput) (*models.Message, error) {
	conv, deliverer, err := s.resolveTarget(ctx, in.WorkspaceID, in.ConversationID, in.ChannelID, in.To)
	if err != nil {
		return nil, err
	}
	rendered, err := s.templateSvc.Use(ctx, UseTemplateInput{
		TemplateID:     in.TemplateID,
		WorkspaceID:    in.WorkspaceID,
		ConversationID: &conv.ID,
		Variables:      in.Variables,
	})
	if err != nil {
		return nil, err
	}
	body := rendered.Body
	if rendered.Footer != nil && *rendered.Footer != "" {
		body = body + "\n\n" + *rendered.Footer
	}
	return deliverer.Deliver(ctx, DeliverInput{
		ChannelID:      conv.ChannelID,
		ConversationID: conv.ID,
		Body:           body,
	})
}

// ListContacts returns workspace contacts with simple pagination.
func (s *PublicAPIService) ListContacts(ctx context.Context, workspaceID, search string, limit, offset int) ([]models.Contact, error) {
	if limit <= 0 || limit > 200 {
		limit = 50
	}
	return s.contacts.ListWithFilters(ctx, repositories.ListFilter{
		WorkspaceID: workspaceID,
		Search:      strings.TrimSpace(search),
		Limit:       limit,
		Offset:      offset,
	})
}

// CreateContactInput is the payload for POST /api/v1/contacts.
type PublicCreateContactInput struct {
	WorkspaceID string
	Name        string
	Phone       *string
	Email       *string
	Company     *string
	Notes       *string
}

// CreateContact creates a contact via the shared ContactService (so the
// activity log + contact.created webhook fire identically to the dashboard).
func (s *PublicAPIService) CreateContact(ctx context.Context, in PublicCreateContactInput) (*models.Contact, error) {
	return s.contactSvc.Create(ctx, CreateContactInput{
		WorkspaceID: in.WorkspaceID,
		Name:        in.Name,
		Phone:       in.Phone,
		Email:       in.Email,
		Company:     in.Company,
		Notes:       in.Notes,
	})
}

// ListConversations returns the workspace inbox list.
func (s *PublicAPIService) ListConversations(ctx context.Context, workspaceID string) ([]models.ConversationListItem, error) {
	return s.conversations.ListByWorkspace(ctx, workspaceID)
}

// ListMessages returns the messages of a conversation after verifying the
// conversation belongs to the API key's workspace.
func (s *PublicAPIService) ListMessages(ctx context.Context, workspaceID, conversationID string) ([]models.Message, error) {
	conv, err := s.conversations.GetByID(ctx, conversationID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrConversationNotFound
		}
		return nil, err
	}
	if conv.WorkspaceID != workspaceID {
		return nil, ErrPublicForbidden
	}
	msgs, err := s.messages.ListByConversation(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	if s.plan != nil {
		if cutoff := s.plan.RetentionCutoff(ctx, workspaceID); cutoff != nil {
			filtered := make([]models.Message, 0, len(msgs))
			for _, m := range msgs {
				if !m.CreatedAt.Before(*cutoff) {
					filtered = append(filtered, m)
				}
			}
			msgs = filtered
		}
	}
	return msgs, nil
}

/* ----------------------------- internal ------------------------------- */

// resolveTarget returns the conversation + its deliverer, creating the
// contact/conversation when sending by recipient. All paths verify the
// resolved resources belong to `workspaceID`.
func (s *PublicAPIService) resolveTarget(ctx context.Context, workspaceID, conversationID, channelID, to string) (*models.Conversation, ChannelDeliverer, error) {
	if conversationID != "" {
		conv, err := s.conversations.GetByID(ctx, conversationID)
		if err != nil {
			if errors.Is(err, repositories.ErrNotFound) {
				return nil, nil, ErrConversationNotFound
			}
			return nil, nil, err
		}
		if conv.WorkspaceID != workspaceID {
			return nil, nil, ErrPublicForbidden
		}
		ch, err := s.channels.GetByID(ctx, conv.ChannelID)
		if err != nil {
			return nil, nil, err
		}
		deliverer, ok := s.deliverers[ch.Type]
		if !ok {
			return nil, nil, ErrNoDeliverer
		}
		return conv, deliverer, nil
	}

	if channelID == "" {
		return nil, nil, ErrChannelRequired
	}
	if strings.TrimSpace(to) == "" {
		return nil, nil, ErrRecipientRequired
	}
	ch, err := s.channels.GetByID(ctx, channelID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, nil, errors.New("channel not found")
		}
		return nil, nil, err
	}
	if ch.WorkspaceID != workspaceID {
		return nil, nil, ErrPublicForbidden
	}
	deliverer, ok := s.deliverers[ch.Type]
	if !ok {
		return nil, nil, ErrNoDeliverer
	}

	contact, err := s.findOrCreateContact(ctx, workspaceID, ch.Type, to)
	if err != nil {
		return nil, nil, err
	}
	conv, err := s.findOrCreateConversation(ctx, workspaceID, ch.ID, contact.ID)
	if err != nil {
		return nil, nil, err
	}
	return conv, deliverer, nil
}

func (s *PublicAPIService) findOrCreateContact(ctx context.Context, workspaceID string, source models.ChannelType, externalID string) (*models.Contact, error) {
	existing, err := s.contacts.FindByExternal(ctx, workspaceID, source, externalID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	// Phone-based contacts also dedupe on phone for WhatsApp.
	if source == models.ChannelWhatsApp {
		if byPhone, pErr := s.contacts.FindByPhone(ctx, workspaceID, externalID); pErr == nil {
			return byPhone, nil
		}
	}
	src := source
	ext := externalID
	var phone *string
	if source == models.ChannelWhatsApp {
		phone = &ext
	}
	return s.contacts.Create(ctx, repositories.CreateContactParams{
		WorkspaceID:    workspaceID,
		Name:           externalID,
		Phone:          phone,
		ExternalSource: &src,
		ExternalID:     &ext,
	})
}

func (s *PublicAPIService) findOrCreateConversation(ctx context.Context, workspaceID, channelID, contactID string) (*models.Conversation, error) {
	existing, err := s.conversations.FindOpenByContactChannel(ctx, channelID, contactID)
	if err == nil {
		return existing, nil
	}
	if !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	return s.conversations.Create(ctx, repositories.CreateConversationParams{
		WorkspaceID: workspaceID,
		ChannelID:   channelID,
		ContactID:   contactID,
		Status:      models.ConvOpen,
	})
}

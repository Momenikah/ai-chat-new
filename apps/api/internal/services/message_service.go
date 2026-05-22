package services

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
)

// Message-related service errors.
var (
	ErrInvalidMessageKind = errors.New("invalid message kind")
	ErrEmptyMessage       = errors.New("message body must not be empty")
)

// ChannelDeliverer is the small slice of a provider-specific service that
// MessageService needs to route outbound messages. WhatsApp, Instagram and
// Messenger all implement it; the demo-echo fallback handles every other
// channel type.
type ChannelDeliverer interface {
	Deliver(ctx context.Context, in DeliverInput) (*models.Message, error)
}

// AutoReplier is the slice of AIReplyService that inbound dispatchers
// (WhatsApp / Instagram / Messenger) need to trigger an AI auto-reply
// after persisting the inbound message. Implemented by AIReplyService.
type AutoReplier interface {
	MaybeReply(ctx context.Context, channelID, conversationID, messageID, inboundText string)
}

// MessageService implements message send/list. Outbound messages on a
// channel with a registered deliverer (whatsapp/instagram/messenger) are
// routed through the provider; otherwise a development "demo echo"
// fabricates an inbound reply 1.5s later so realtime can be exercised
// without a real provider.
type MessageService struct {
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	channels      *repositories.ChannelRepository
	deliverers    map[models.ChannelType]ChannelDeliverer
	broadcaster   realtime.Broadcaster
	demoEcho      bool
	plan          PlanEnforcer
}

// NewMessageService constructs a MessageService. `deliverers` may be nil
// or empty; only registered channel types are routed externally.
func NewMessageService(
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	channels *repositories.ChannelRepository,
	deliverers map[models.ChannelType]ChannelDeliverer,
	broadcaster realtime.Broadcaster,
	demoEcho bool,
) *MessageService {
	if deliverers == nil {
		deliverers = map[models.ChannelType]ChannelDeliverer{}
	}
	return &MessageService{
		conversations: conversations,
		messages:      messages,
		channels:      channels,
		deliverers:    deliverers,
		broadcaster:   broadcaster,
		demoEcho:      demoEcho,
	}
}

// SetPlanEnforcer wires plan-based message-history retention. Optional.
func (s *MessageService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// List returns the messages of a conversation, oldest first. As a side
// effect the unread counter is reset (opening the thread). Messages older
// than the plan's history-retention window are hidden.
func (s *MessageService) List(ctx context.Context, conversationID string) ([]models.Message, error) {
	msgs, err := s.messages.ListByConversation(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	_ = s.conversations.ResetUnread(ctx, conversationID)
	return s.applyRetention(ctx, msgs), nil
}

// applyRetention drops messages older than the plan's history window.
func (s *MessageService) applyRetention(ctx context.Context, msgs []models.Message) []models.Message {
	if s.plan == nil || len(msgs) == 0 {
		return msgs
	}
	cutoff := s.plan.RetentionCutoff(ctx, msgs[0].WorkspaceID)
	if cutoff == nil {
		return msgs
	}
	out := make([]models.Message, 0, len(msgs))
	for _, m := range msgs {
		if !m.CreatedAt.Before(*cutoff) {
			out = append(out, m)
		}
	}
	return out
}

// SendInput is the payload for an outbound message.
type SendInput struct {
	ConversationID string
	SenderUserID   string
	Body           string
	Kind           models.MessageKind
}

// Send creates an outbound message, updates the conversation snapshot and
// broadcasts to connected agents. With demoEcho enabled it schedules a
// fake inbound reply 1.5s later so the realtime path is observable.
func (s *MessageService) Send(ctx context.Context, in SendInput) (*models.Message, error) {
	body := strings.TrimSpace(in.Body)
	if body == "" {
		return nil, ErrEmptyMessage
	}
	if in.Kind == "" {
		in.Kind = models.KindText
	}
	if !in.Kind.Valid() {
		return nil, ErrInvalidMessageKind
	}

	conv, err := s.conversations.GetByID(ctx, in.ConversationID)
	if err != nil {
		if errors.Is(err, repositories.ErrNotFound) {
			return nil, ErrConversationNotFound
		}
		return nil, err
	}

	// Human takeover: a human agent typed this. Auto-assign the conversation
	// and stop the AI bot from replying on this thread.
	if in.SenderUserID != "" {
		if conv.AssignedAgentID == nil || *conv.AssignedAgentID == "" {
			senderID := in.SenderUserID
			_, _ = s.conversations.Assign(ctx, conv.ID, &senderID)
			_ = s.conversations.RecordAssignment(ctx, conv.ID, &senderID, &senderID)
		}
		_ = s.conversations.SetAIDisabled(ctx, conv.ID, true)
	}

	// Route through the real provider when the conversation lives on a
	// channel with a registered deliverer (WhatsApp / Instagram / Messenger).
	// The deliverer handles persistence + retry + WS.
	if s.channels != nil && len(s.deliverers) > 0 {
		if ch, err := s.channels.GetByID(ctx, conv.ChannelID); err == nil {
			if deliverer, ok := s.deliverers[ch.Type]; ok {
				return deliverer.Deliver(ctx, DeliverInput{
					ChannelID:      ch.ID,
					ConversationID: conv.ID,
					SenderUserID:   in.SenderUserID,
					Body:           body,
				})
			}
		}
	}

	sender := in.SenderUserID
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: in.ConversationID,
		WorkspaceID:    conv.WorkspaceID,
		Direction:      models.MsgOutbound,
		Kind:           in.Kind,
		Body:           &body,
		Status:         models.MsgSent,
		SenderUserID:   &sender,
	})
	if err != nil {
		return nil, err
	}

	if err := s.conversations.TouchLastMessage(ctx, conv.ID, body); err != nil {
		log.Printf("messages: touch last_message: %v", err)
	}

	s.broadcastNew(msg)
	if s.demoEcho {
		go s.scheduleDemoEcho(conv.WorkspaceID, conv.ID, body)
	}
	return msg, nil
}

// scheduleDemoEcho fakes an inbound reply so realtime can be exercised
// without a real channel provider. Disabled in production via config.
func (s *MessageService) scheduleDemoEcho(workspaceID, conversationID, original string) {
	time.Sleep(1500 * time.Millisecond)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	reply := buildDemoReply(original)
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conversationID,
		WorkspaceID:    workspaceID,
		Direction:      models.MsgInbound,
		Kind:           models.KindText,
		Body:           &reply,
		Status:         models.MsgDelivered,
	})
	if err != nil {
		log.Printf("messages: demo echo create: %v", err)
		return
	}
	if err := s.conversations.TouchLastMessage(ctx, conversationID, reply); err != nil {
		log.Printf("messages: demo echo touch: %v", err)
	}
	if err := s.conversations.IncrementUnread(ctx, conversationID); err != nil {
		log.Printf("messages: demo echo unread: %v", err)
	}
	s.broadcastNew(msg)
}

func buildDemoReply(original string) string {
	lower := strings.ToLower(original)
	switch {
	case strings.Contains(lower, "halo"), strings.Contains(lower, "hi"), strings.Contains(lower, "hai"):
		return "Halo juga! Ada yang bisa saya bantu?"
	case strings.Contains(lower, "harga"):
		return "Untuk informasi harga lengkap, silakan cek katalog kami ya."
	case strings.Contains(lower, "terima kasih"):
		return "Sama-sama 🙏 senang bisa membantu."
	default:
		return "Pesan diterima, terima kasih. Tim kami akan segera membalas."
	}
}

func (s *MessageService) broadcastNew(msg *models.Message) {
	if s.broadcaster == nil {
		return
	}
	s.broadcaster.Broadcast(msg.WorkspaceID, realtime.Event{
		Type:    realtime.EventMessageNew,
		Payload: msg,
	})
}

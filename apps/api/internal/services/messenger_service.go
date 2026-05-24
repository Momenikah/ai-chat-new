package services

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/messenger"
	"github.com/aichat/api/internal/meta"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/webhook"
)

// MessengerService coordinates outbound delivery, inbound dispatch and
// status callbacks for the Facebook Messenger Platform.
type MessengerService struct {
	pool          *pgxpool.Pool
	channels      *repositories.ChannelRepository
	contacts      *repositories.ContactRepository
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	members       *repositories.WorkspaceMemberRepository
	webhookLogs   *repositories.WebhookLogRepository
	encryptor     *crypto.Encryptor
	client        *meta.Client
	broadcaster   realtime.Broadcaster
	autoReplier   AutoReplier
	webhooks      webhook.Dispatcher

	verifyToken string
	appSecret   string
	publicBase  string
}

// SetAutoReplier wires the AI auto-reply hook. Optional; if nil, inbound
// messages skip the AI pipeline entirely. Used to break the import cycle
// between provider services and AIReplyService.
func (s *MessengerService) SetAutoReplier(r AutoReplier) { s.autoReplier = r }

// SetWebhookDispatcher wires outbound webhook emission. Optional.
func (s *MessengerService) SetWebhookDispatcher(d webhook.Dispatcher) {
	if d != nil {
		s.webhooks = d
	}
}

func (s *MessengerService) emitWebhook(workspaceID string, event webhook.Event, data interface{}) {
	if s.webhooks != nil {
		s.webhooks.Emit(workspaceID, event, data)
	}
}

// NewMessengerService constructs a MessengerService.
func NewMessengerService(
	pool *pgxpool.Pool,
	channels *repositories.ChannelRepository,
	contacts *repositories.ContactRepository,
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	members *repositories.WorkspaceMemberRepository,
	webhookLogs *repositories.WebhookLogRepository,
	encryptor *crypto.Encryptor,
	client *meta.Client,
	broadcaster realtime.Broadcaster,
	verifyToken, appSecret, publicBase string,
) *MessengerService {
	return &MessengerService{
		pool: pool, channels: channels, contacts: contacts,
		conversations: conversations, messages: messages,
		members: members, webhookLogs: webhookLogs,
		encryptor: encryptor, client: client, broadcaster: broadcaster,
		verifyToken: verifyToken, appSecret: appSecret, publicBase: publicBase,
	}
}

/* ------------------------- Webhook verification ------------------------- */

func (s *MessengerService) VerifyWebhook(mode, token, challenge string) (string, error) {
	return meta.VerifyChallenge(mode, token, challenge, s.verifyToken)
}

func (s *MessengerService) VerifySignature(rawBody []byte, header string) error {
	return meta.VerifyHMAC(rawBody, header, s.appSecret)
}

func (s *MessengerService) WebhookURL() string {
	return strings.TrimRight(s.publicBase, "/") + "/api/webhooks/messenger"
}

/* ----------------------------- Channel connect ------------------------- */

// MessengerConnectInput is the payload for /channels/messenger/connect.
type MessengerConnectInput struct {
	WorkspaceID        string
	Name               string
	PageID             string
	PageAccessToken    string
	WebhookVerifyToken string
}

// Connect creates a Messenger channel and stores its credentials encrypted.
func (s *MessengerService) Connect(ctx context.Context, in MessengerConnectInput) (*models.Channel, error) {
	creds := messenger.Credentials{
		PageID:             strings.TrimSpace(in.PageID),
		PageAccessToken:    strings.TrimSpace(in.PageAccessToken),
		WebhookVerifyToken: strings.TrimSpace(in.WebhookVerifyToken),
	}
	if err := creds.Validate(); err != nil {
		return nil, err
	}

	list, err := s.channels.ListByWorkspace(ctx, in.WorkspaceID)
	if err != nil {
		return nil, err
	}
	var channel *models.Channel
	for i := range list {
		c := &list[i]
		if c.Type == models.ChannelMessenger && c.ExternalID != nil && *c.ExternalID == creds.PageID {
			channel = c
			break
		}
	}

	if channel == nil {
		ext := creds.PageID
		channel, err = s.channels.Create(ctx, repositories.CreateChannelParams{
			WorkspaceID: in.WorkspaceID,
			Type:        models.ChannelMessenger,
			Name:        in.Name,
			Status:      models.StatusPending,
			ExternalID:  &ext,
		})
		if err != nil {
			return nil, err
		}
	} else {
		now := time.Now()
		updated, err := s.channels.Update(ctx, repositories.UpdateChannelParams{
			ID:              channel.ID,
			Name:            in.Name,
			Status:          models.StatusPending,
			ExternalID:      channel.ExternalID,
			LastConnectedAt: &now,
		})
		if err != nil {
			return nil, err
		}
		channel = updated
	}

	plain, err := json.Marshal(creds)
	if err != nil {
		return nil, err
	}
	ciphertext, nonce, err := s.encryptor.Encrypt(plain)
	if err != nil {
		return nil, err
	}
	if err := s.channels.UpsertCredentials(ctx, channel.ID, ciphertext, nonce); err != nil {
		return nil, err
	}

	channel.HasCredentials = true
	return channel, nil
}

/* ------------------------------- Send ---------------------------------- */

// Deliver sends a Messenger message. Satisfies the ChannelDeliverer interface.
func (s *MessengerService) Deliver(ctx context.Context, in DeliverInput) (*models.Message, error) {
	conv, err := s.conversations.GetByID(ctx, in.ConversationID)
	if err != nil {
		return nil, ErrConversationNotFound
	}
	if err := s.requireMember(ctx, conv.WorkspaceID, in.SenderUserID); err != nil {
		return nil, err
	}
	channelID := in.ChannelID
	if channelID == "" {
		channelID = conv.ChannelID
	} else if channelID != conv.ChannelID {
		return nil, errors.New("channel_id does not match the conversation")
	}
	contact, err := s.contacts.GetByID(ctx, conv.ContactID)
	if err != nil {
		return nil, err
	}
	if contact.ExternalID == nil || *contact.ExternalID == "" {
		return nil, errors.New("contact has no Messenger PSID")
	}
	creds, err := messenger.LoadCredentials(ctx, s.channels, s.encryptor, channelID)
	if err != nil {
		return nil, err
	}

	body := strings.TrimSpace(in.Body)
	sender := in.SenderUserID
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conv.ID,
		WorkspaceID:    conv.WorkspaceID,
		Direction:      models.MsgOutbound,
		Kind:           models.KindText,
		Body:           &body,
		Status:         models.MsgQueued,
		SenderUserID:   &sender,
	})
	if err != nil {
		return nil, err
	}
	_ = s.conversations.TouchLastMessage(ctx, conv.ID, body)
	s.broadcast(realtime.EventMessageNew, conv.WorkspaceID, msg)

	if err := s.attemptDelivery(ctx, msg, creds, *contact.ExternalID, body); err != nil {
		log.Printf("messenger: initial delivery failed (msg=%s): %v", msg.ID, err)
		go s.retryDelivery(msg.ID, conv.WorkspaceID, creds, *contact.ExternalID, body)
	}
	return msg, nil
}

func (s *MessengerService) attemptDelivery(ctx context.Context, msg *models.Message, creds *messenger.Credentials, to, body string) error {
	externalID, err := s.client.SendMessage(ctx, creds.PageAccessToken, "", to, body)
	if err != nil {
		return err
	}
	_ = s.messages.SetExternalID(ctx, msg.ID, externalID)
	_ = s.messages.UpdateStatus(ctx, msg.ID, models.MsgSent)
	msg.ExternalID = &externalID
	msg.Status = models.MsgSent
	s.broadcast(realtime.EventMessageUpdated, msg.WorkspaceID, msg)
	s.emitWebhook(msg.WorkspaceID, webhook.EventMessageSent, msg)
	return nil
}

func (s *MessengerService) retryDelivery(messageID, workspaceID string, creds *messenger.Credentials, to, body string) {
	for i, d := range []time.Duration{2 * time.Second, 8 * time.Second, 24 * time.Second} {
		time.Sleep(d)
		ctx, cancel := context.WithTimeout(context.Background(), 25*time.Second)
		msg, err := s.messages.GetByID(ctx, messageID)
		if err != nil {
			cancel()
			return
		}
		if err := s.attemptDelivery(ctx, msg, creds, to, body); err == nil {
			cancel()
			return
		} else {
			log.Printf("messenger: retry %d for msg %s: %v", i+1, messageID, err)
		}
		cancel()
	}
	_ = s.messages.UpdateStatus(context.Background(), messageID, models.MsgFailed)
	if msg, err := s.messages.GetByID(context.Background(), messageID); err == nil {
		s.broadcast(realtime.EventMessageUpdated, workspaceID, msg)
	}
}

/* --------------------- Incoming webhook dispatch ----------------------- */

// HandleIncoming parses a Messenger webhook envelope and dispatches it.
func (s *MessengerService) HandleIncoming(ctx context.Context, rawBody []byte, env meta.WebhookEnvelope) error {
	if env.Object != "" && env.Object != "page" {
		return nil
	}
	for _, entry := range env.Entry {
		channel, err := s.channels.FindByExternalID(ctx, models.ChannelMessenger, entry.ID)
		if err != nil {
			s.logWebhook(ctx, nil, nil, "messages", http.StatusOK,
				rawBody, fmt.Errorf("no channel for page_id=%s", entry.ID))
			continue
		}

		if channel.Status != models.StatusConnected {
			now := time.Now()
			_, _ = s.channels.Update(ctx, repositories.UpdateChannelParams{
				ID:              channel.ID,
				Name:            channel.Name,
				Status:          models.StatusConnected,
				ExternalID:      channel.ExternalID,
				LastConnectedAt: &now,
			})
		}

		creds, _ := messenger.LoadCredentials(ctx, s.channels, s.encryptor, channel.ID)
		token := ""
		if creds != nil {
			token = creds.PageAccessToken
		}

		for _, ev := range entry.Messaging {
			if ev.Message != nil && !ev.Message.IsEcho {
				if err := s.processInbound(ctx, channel, token, ev); err != nil {
					log.Printf("messenger: process inbound: %v", err)
				}
			} else if ev.Delivery != nil {
				s.processStatus(ctx, ev.Delivery.MIDs, models.MsgDelivered)
			} else if ev.Read != nil {
				_ = ev
			}
		}

		wsID := channel.WorkspaceID
		chID := channel.ID
		s.logWebhook(ctx, &wsID, &chID, "messages", http.StatusOK, rawBody, nil)
	}
	return nil
}

func (s *MessengerService) processInbound(ctx context.Context, channel *models.Channel, accessToken string, ev meta.MessagingEvent) error {
	contact, contactCreated, err := upsertMetaContact(ctx, s.contacts, s.client, channel,
		ev.Sender.ID, accessToken)
	if err != nil {
		return err
	}
	if contactCreated {
		s.emitWebhook(channel.WorkspaceID, webhook.EventContactCreated, contact)
	}
	conv, convCreated, err := upsertOpenConversation(ctx, s.conversations, channel, contact.ID)
	if err != nil {
		return err
	}
	if convCreated {
		s.emitWebhook(channel.WorkspaceID, webhook.EventConversationCreated, conv)
	}
	body, kind := bodyFromMetaMessage(ev.Message)
	extID := ""
	if ev.Message != nil {
		extID = ev.Message.MID
	}
	bodyPtr := body
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conv.ID,
		WorkspaceID:    channel.WorkspaceID,
		Direction:      models.MsgInbound,
		Kind:           kind,
		Body:           &bodyPtr,
		Status:         models.MsgDelivered,
	})
	if err != nil {
		return err
	}
	if extID != "" {
		_ = s.messages.SetExternalID(ctx, msg.ID, extID)
		msg.ExternalID = &extID
	}
	preview := body
	if preview == "" {
		preview = "(" + string(kind) + ")"
	}
	_ = s.conversations.TouchLastMessage(ctx, conv.ID, preview)
	_ = s.conversations.IncrementUnread(ctx, conv.ID)
	s.broadcast(realtime.EventMessageNew, channel.WorkspaceID, msg)
	s.emitWebhook(channel.WorkspaceID, webhook.EventMessageReceived, msg)

	if ev.Message != nil && len(ev.Message.Attachments) > 0 {
		a := ev.Message.Attachments[0]
		if a.Payload.URL != "" {
			t := a.Type
			_ = s.messages.CreateAttachment(ctx, repositories.CreateAttachmentParams{
				MessageID: msg.ID,
				URL:       a.Payload.URL,
				MimeType:  &t,
			})
		}
	}

	if s.autoReplier != nil && body != "" {
		go s.autoReplier.MaybeReply(context.Background(), channel.ID, conv.ID, msg.ID, body)
	}
	return nil
}

func (s *MessengerService) processStatus(ctx context.Context, mids []string, status models.MessageStatus) {
	for _, mid := range mids {
		updated, err := s.messages.UpdateStatusByExternalID(ctx, mid, status)
		if err != nil || !updated {
			continue
		}
		if msg, err := s.messages.GetByExternalID(ctx, mid); err == nil {
			s.broadcast(realtime.EventMessageUpdated, msg.WorkspaceID, msg)
			if status == models.MsgDelivered {
				s.emitWebhook(msg.WorkspaceID, webhook.EventMessageDelivered, msg)
			}
		}
	}
}

/* -------------------------------- shared ------------------------------- */

func (s *MessengerService) requireMember(ctx context.Context, workspaceID, userID string) error {
	if userID == "" || s.members == nil {
		return nil
	}
	member, err := s.members.Get(ctx, workspaceID, userID)
	if err != nil || member.Status != models.MemberActive ||
		!member.Role.AtLeast(models.RoleAgent) {
		return errors.New("forbidden: not a workspace member")
	}
	return nil
}

func (s *MessengerService) broadcast(eventType, workspaceID string, payload interface{}) {
	if s.broadcaster == nil {
		return
	}
	s.broadcaster.Broadcast(workspaceID, realtime.Event{Type: eventType, Payload: payload})
}

func (s *MessengerService) logWebhook(ctx context.Context, workspaceID, channelID *string, eventType string, statusCode int, payload []byte, sourceErr error) {
	logMetaWebhook(ctx, s.webhookLogs, "messenger", workspaceID, channelID, eventType, statusCode, payload, sourceErr)
}

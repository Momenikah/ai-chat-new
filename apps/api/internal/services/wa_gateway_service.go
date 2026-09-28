package services

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/netguard"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/wagateway"
	"github.com/aichat/api/internal/webhook"
)

// Gateway service errors surfaced to handlers.
var (
	ErrGatewayUnknownProvider = errors.New("provider must be onesender or starsender")
	ErrGatewayPrivateURL      = errors.New("OneSender URL must point to a public host")
	ErrGatewayNotFound        = errors.New("gateway channel not found")
	ErrGatewayUnauthorized    = errors.New("invalid webhook token")
)

// GatewayService runs unofficial WhatsApp gateway channels (OneSender,
// StarSender): connecting, outbound delivery (inbox, AI replies, public
// API) and inbound webhooks. Broadcasts go through the worker.
type GatewayService struct {
	channels      *repositories.ChannelRepository
	contacts      *repositories.ContactRepository
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	members       *repositories.WorkspaceMemberRepository
	webhookLogs   *repositories.WebhookLogRepository
	encryptor     *crypto.Encryptor
	client        *wagateway.Client
	broadcaster   realtime.Broadcaster
	autoReplier   AutoReplier
	webhooks      webhook.Dispatcher
	plan          PlanEnforcer

	publicBase string
	// allowPrivate permits OneSender instance URLs on private networks.
	allowPrivate bool
	// retryDelays between delivery attempts after an inline failure.
	retryDelays []time.Duration
}

// NewGatewayService constructs a GatewayService.
func NewGatewayService(
	channels *repositories.ChannelRepository,
	contacts *repositories.ContactRepository,
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	members *repositories.WorkspaceMemberRepository,
	webhookLogs *repositories.WebhookLogRepository,
	encryptor *crypto.Encryptor,
	client *wagateway.Client,
	broadcaster realtime.Broadcaster,
	publicBase string,
	allowPrivate bool,
) *GatewayService {
	return &GatewayService{
		channels: channels, contacts: contacts, conversations: conversations,
		messages: messages, members: members, webhookLogs: webhookLogs,
		encryptor: encryptor, client: client, broadcaster: broadcaster,
		publicBase: publicBase, allowPrivate: allowPrivate,
		retryDelays: []time.Duration{2 * time.Second, 8 * time.Second, 24 * time.Second},
	}
}

// SetAutoReplier wires the AI auto-reply hook. Optional.
func (s *GatewayService) SetAutoReplier(r AutoReplier) { s.autoReplier = r }

// SetWebhookDispatcher wires outbound webhook emission. Optional.
func (s *GatewayService) SetWebhookDispatcher(d webhook.Dispatcher) { s.webhooks = d }

// SetPlanEnforcer wires plan-limit enforcement. Optional (nil = allow).
func (s *GatewayService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// WebhookURL is the callback URL to configure in the gateway dashboard.
// The token authenticates the caller because gateways do not sign
// their webhooks.
func (s *GatewayService) WebhookURL(channelID, token string) string {
	return strings.TrimRight(s.publicBase, "/") + "/api/webhooks/wa-gateway/" + channelID + "/" + token
}

/* ------------------------------- Connect -------------------------------- */

// GatewayConnectInput is the payload for connecting a gateway channel.
type GatewayConnectInput struct {
	WorkspaceID string
	Provider    wagateway.Provider
	ChannelID   string // optional: re-key this existing channel
	Name        string
	APIKey      string
	BaseURL     string // OneSender only
	PhoneNumber string // optional, display + dedupe
}

// GatewayInfo is the non-secret view of a gateway channel's setup.
type GatewayInfo struct {
	Channel     *models.Channel    `json:"channel"`
	Provider    wagateway.Provider `json:"provider"`
	BaseURL     string             `json:"base_url,omitempty"`
	PhoneNumber string             `json:"phone_number,omitempty"`
	WebhookURL  string             `json:"webhook_url"`
	// APIKeyHint shows only the last 4 characters of the key.
	APIKeyHint string `json:"api_key_hint"`
}

// Connect creates (or re-keys) a gateway channel. Reconnecting — by
// channel id or by the same phone number — keeps the channel, its history
// and its webhook URL.
func (s *GatewayService) Connect(ctx context.Context, in GatewayConnectInput) (*GatewayInfo, error) {
	if !in.Provider.Valid() {
		return nil, ErrGatewayUnknownProvider
	}
	creds := wagateway.Credentials{
		Provider:    in.Provider,
		APIKey:      strings.TrimSpace(in.APIKey),
		PhoneNumber: wagateway.NormalizePhone(in.PhoneNumber),
	}
	// Validate everything before touching the database so a bad request
	// never leaves a half-created channel behind.
	if creds.APIKey == "" {
		return nil, wagateway.ErrInvalidCredentials
	}
	if in.Provider == wagateway.ProviderOneSender {
		creds.BaseURL = strings.TrimRight(strings.TrimSpace(in.BaseURL), "/")
		if err := s.validateBaseURL(creds.BaseURL); err != nil {
			return nil, err
		}
	}
	chType := models.ChannelType(in.Provider)

	list, err := s.channels.ListByWorkspace(ctx, in.WorkspaceID)
	if err != nil {
		return nil, err
	}
	var channel *models.Channel
	waCount := 0
	for i := range list {
		if !list[i].Type.IsWhatsApp() {
			continue
		}
		waCount++
		if list[i].Type != chType || channel != nil {
			continue
		}
		if in.ChannelID != "" && list[i].ID == in.ChannelID {
			channel = &list[i]
		} else if in.ChannelID == "" && creds.PhoneNumber != "" &&
			list[i].ExternalID != nil && *list[i].ExternalID == creds.PhoneNumber {
			channel = &list[i]
		}
	}
	// The workspace-scoped list guarantees a given channel id belongs to
	// this workspace; anything else is not found.
	if in.ChannelID != "" && channel == nil {
		return nil, ErrGatewayNotFound
	}
	if channel != nil && creds.PhoneNumber == "" && channel.ExternalID != nil {
		creds.PhoneNumber = *channel.ExternalID
	}

	var external *string
	if creds.PhoneNumber != "" {
		external = &creds.PhoneNumber
	}
	if channel == nil {
		// A new number counts against the plan's WhatsApp number limit,
		// shared with official Cloud API channels.
		if err := ensureCanAdd(s.plan, ctx, in.WorkspaceID, ResourceWhatsAppNumbers, waCount); err != nil {
			return nil, err
		}
		channel, err = s.channels.Create(ctx, repositories.CreateChannelParams{
			WorkspaceID: in.WorkspaceID,
			Type:        chType,
			Name:        in.Name,
			Status:      models.StatusPending,
			ExternalID:  external,
		})
		if err != nil {
			return nil, err
		}
	} else {
		// Keep the existing webhook URL working across re-keys.
		if old, err := wagateway.LoadCredentials(ctx, s.channels, s.encryptor, channel.ID); err == nil {
			creds.WebhookToken = old.WebhookToken
		}
		channel, err = s.channels.Update(ctx, repositories.UpdateChannelParams{
			ID:              channel.ID,
			Name:            in.Name,
			Status:          models.StatusPending,
			ExternalID:      external,
			LastConnectedAt: channel.LastConnectedAt,
		})
		if err != nil {
			return nil, err
		}
	}

	if creds.WebhookToken == "" {
		if creds.WebhookToken, err = wagateway.NewWebhookToken(); err != nil {
			return nil, err
		}
	}
	if err := creds.Validate(); err != nil {
		return nil, err
	}
	if err := s.storeCredentials(ctx, channel.ID, &creds); err != nil {
		return nil, err
	}
	channel.HasCredentials = true
	return s.info(channel, &creds), nil
}

func (s *GatewayService) validateBaseURL(raw string) error {
	switch err := checkOutboundURL(raw, s.allowPrivate); {
	case errors.Is(err, netguard.ErrBlockedAddress):
		return ErrGatewayPrivateURL
	case err != nil:
		return wagateway.ErrInvalidCredentials
	}
	return nil
}

func (s *GatewayService) storeCredentials(ctx context.Context, channelID string, creds *wagateway.Credentials) error {
	plain, err := json.Marshal(creds)
	if err != nil {
		return err
	}
	ciphertext, nonce, err := s.encryptor.Encrypt(plain)
	if err != nil {
		return err
	}
	return s.channels.UpsertCredentials(ctx, channelID, ciphertext, nonce)
}

func (s *GatewayService) info(channel *models.Channel, creds *wagateway.Credentials) *GatewayInfo {
	hint := ""
	if n := len(creds.APIKey); n > 4 {
		hint = "••••" + creds.APIKey[n-4:]
	}
	return &GatewayInfo{
		Channel:     channel,
		Provider:    creds.Provider,
		BaseURL:     creds.BaseURL,
		PhoneNumber: creds.PhoneNumber,
		WebhookURL:  s.WebhookURL(channel.ID, creds.WebhookToken),
		APIKeyHint:  hint,
	}
}

// loadGateway fetches a gateway channel and its credentials.
func (s *GatewayService) loadGateway(ctx context.Context, channelID string) (*models.Channel, *wagateway.Credentials, error) {
	channel, err := s.channels.GetByID(ctx, channelID)
	if err != nil || !channel.Type.IsWAGateway() {
		return nil, nil, ErrGatewayNotFound
	}
	creds, err := wagateway.LoadCredentials(ctx, s.channels, s.encryptor, channelID)
	if err != nil {
		return nil, nil, err
	}
	return channel, creds, nil
}

// Info returns the setup details (webhook URL etc.) of a gateway channel.
func (s *GatewayService) Info(ctx context.Context, channelID string) (*GatewayInfo, error) {
	channel, creds, err := s.loadGateway(ctx, channelID)
	if err != nil {
		return nil, err
	}
	return s.info(channel, creds), nil
}

// RotateWebhookToken issues a new webhook token; the old URL stops working.
func (s *GatewayService) RotateWebhookToken(ctx context.Context, channelID string) (*GatewayInfo, error) {
	channel, creds, err := s.loadGateway(ctx, channelID)
	if err != nil {
		return nil, err
	}
	if creds.WebhookToken, err = wagateway.NewWebhookToken(); err != nil {
		return nil, err
	}
	if err := s.storeCredentials(ctx, channel.ID, creds); err != nil {
		return nil, err
	}
	return s.info(channel, creds), nil
}

// SendTest sends a message straight through the gateway (no inbox
// record) so an admin can verify the API key and device. The channel's
// status reflects the outcome.
func (s *GatewayService) SendTest(ctx context.Context, channelID, to, body string) error {
	channel, creds, err := s.loadGateway(ctx, channelID)
	if err != nil {
		return err
	}
	_, sendErr := s.client.Send(ctx, creds, wagateway.Outbound{To: to, Text: body})
	s.markChannel(ctx, channel, sendErr)
	return sendErr
}

// markChannel records the latest connectivity outcome on the channel.
func (s *GatewayService) markChannel(ctx context.Context, channel *models.Channel, sendErr error) {
	status := models.StatusConnected
	var errMsg *string
	if sendErr != nil {
		status = models.StatusError
		m := truncate(sendErr.Error(), 250)
		errMsg = &m
	}
	if channel.Status == status && sendErr == nil {
		return
	}
	params := repositories.UpdateChannelParams{
		ID:              channel.ID,
		Name:            channel.Name,
		Status:          status,
		ExternalID:      channel.ExternalID,
		ErrorMessage:    errMsg,
		LastConnectedAt: channel.LastConnectedAt,
	}
	if sendErr == nil {
		now := time.Now()
		params.LastConnectedAt = &now
	}
	if updated, err := s.channels.Update(ctx, params); err == nil {
		*channel = *updated
	}
}

/* -------------------------------- Send ---------------------------------- */

// Deliver sends an inbox message through the gateway. Satisfies
// ChannelDeliverer, so the inbox, AI auto-replies and the public API all
// route through here for gateway channels.
func (s *GatewayService) Deliver(ctx context.Context, in DeliverInput) (*models.Message, error) {
	conv, err := s.conversations.GetByID(ctx, in.ConversationID)
	if err != nil {
		return nil, ErrConversationNotFound
	}
	if in.SenderUserID != "" && s.members != nil {
		member, mErr := s.members.Get(ctx, conv.WorkspaceID, in.SenderUserID)
		if mErr != nil || member.Status != models.MemberActive ||
			!member.Role.AtLeast(models.RoleAgent) {
			return nil, errors.New("forbidden: not a workspace member")
		}
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
	if contact.Phone == nil || wagateway.NormalizePhone(*contact.Phone) == "" {
		return nil, ErrContactMissingPhone
	}
	creds, err := wagateway.LoadCredentials(ctx, s.channels, s.encryptor, channelID)
	if err != nil {
		return nil, err
	}

	body := strings.TrimSpace(in.Body)
	var sender *string
	if in.SenderUserID != "" {
		sender = &in.SenderUserID
	}
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conv.ID,
		WorkspaceID:    conv.WorkspaceID,
		Direction:      models.MsgOutbound,
		Kind:           models.KindText,
		Body:           &body,
		Status:         models.MsgQueued,
		SenderUserID:   sender,
	})
	if err != nil {
		return nil, err
	}
	_ = s.conversations.TouchLastMessage(ctx, conv.ID, body)
	s.broadcast(realtime.EventMessageNew, conv.WorkspaceID, msg)

	to := *contact.Phone
	if err := s.attemptDelivery(ctx, msg, channelID, creds, to, body); err != nil {
		log.Printf("wagateway: initial delivery failed (msg=%s): %v", msg.ID, err)
		go s.retryDelivery(msg.ID, conv.WorkspaceID, channelID, creds, to, body)
	}
	return msg, nil
}

func (s *GatewayService) attemptDelivery(ctx context.Context, msg *models.Message, channelID string, creds *wagateway.Credentials, to, body string) error {
	externalID, err := s.client.Send(ctx, creds, wagateway.Outbound{To: to, Text: body})
	if err != nil {
		return err
	}
	if externalID != "" {
		externalID = gatewayExternalID(channelID, externalID)
		_ = s.messages.SetExternalID(ctx, msg.ID, externalID)
		msg.ExternalID = &externalID
	}
	_ = s.messages.UpdateStatus(ctx, msg.ID, models.MsgSent)
	msg.Status = models.MsgSent
	s.broadcast(realtime.EventMessageUpdated, msg.WorkspaceID, msg)
	s.emitWebhook(msg.WorkspaceID, webhook.EventMessageSent, msg)
	return nil
}

func (s *GatewayService) retryDelivery(messageID, workspaceID, channelID string, creds *wagateway.Credentials, to, body string) {
	for i, d := range s.retryDelays {
		time.Sleep(d)
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		msg, err := s.messages.GetByID(ctx, messageID)
		if err != nil {
			cancel()
			return
		}
		err = s.attemptDelivery(ctx, msg, channelID, creds, to, body)
		cancel()
		if err == nil {
			return
		}
		log.Printf("wagateway: retry %d for msg %s: %v", i+1, messageID, err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = s.messages.UpdateStatus(ctx, messageID, models.MsgFailed)
	if msg, err := s.messages.GetByID(ctx, messageID); err == nil {
		s.broadcast(realtime.EventMessageUpdated, workspaceID, msg)
	}
}

// gatewayExternalID namespaces provider ids per channel: gateway ids are
// not globally unique, and messages are looked up by external id.
func gatewayExternalID(channelID, providerID string) string {
	return "gw:" + channelID + ":" + providerID
}

/* ------------------------------- Webhook -------------------------------- */

// GatewayWebhookResult summarises one webhook delivery.
type GatewayWebhookResult struct {
	Received int `json:"received"`
	Stored   int `json:"stored"`
	Skipped  int `json:"skipped"`
}

// HandleWebhook authenticates and processes a gateway callback.
func (s *GatewayService) HandleWebhook(ctx context.Context, channelID, token string, raw []byte) (*GatewayWebhookResult, error) {
	channel, creds, err := s.loadGateway(ctx, channelID)
	if err != nil {
		return nil, ErrGatewayNotFound
	}
	if !creds.TokenMatches(token) {
		return nil, ErrGatewayUnauthorized
	}
	wsID, chID := channel.WorkspaceID, channel.ID
	provider := string(channel.Type)

	events, err := wagateway.ParseWebhook(raw)
	if err != nil {
		logMetaWebhook(ctx, s.webhookLogs, provider, &wsID, &chID, "invalid_json",
			http.StatusBadRequest, jsonPayload(raw), err)
		return nil, err
	}

	// Any authenticated callback proves the gateway can reach us.
	s.markChannel(ctx, channel, nil)

	res := &GatewayWebhookResult{Received: len(events)}
	var firstErr error
	for _, ev := range events {
		if ev.Ignorable() {
			res.Skipped++
			continue
		}
		stored, err := s.processInbound(ctx, channel, ev)
		if err != nil {
			log.Printf("wagateway: inbound (channel=%s): %v", channel.ID, err)
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if stored {
			res.Stored++
		} else {
			res.Skipped++
		}
	}
	logMetaWebhook(ctx, s.webhookLogs, provider, &wsID, &chID, "messages",
		http.StatusOK, jsonPayload(raw), firstErr)
	return res, nil
}

// processInbound stores one inbound message. Returns false for
// duplicates (gateways retry deliveries).
func (s *GatewayService) processInbound(ctx context.Context, channel *models.Channel, ev wagateway.Inbound) (bool, error) {
	var extID string
	if ev.ID != "" {
		extID = gatewayExternalID(channel.ID, ev.ID)
		if _, err := s.messages.GetByExternalID(ctx, extID); err == nil {
			return false, nil
		}
	}

	contact, err := s.upsertContact(ctx, channel, ev)
	if err != nil {
		return false, err
	}
	conv, convCreated, err := upsertOpenConversation(ctx, s.conversations, channel, contact.ID)
	if err != nil {
		return false, err
	}
	if convCreated {
		s.emitWebhook(channel.WorkspaceID, webhook.EventConversationCreated, conv)
	}

	kind := gatewayMessageKind(ev)
	body := ev.Text
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conv.ID,
		WorkspaceID:    channel.WorkspaceID,
		Direction:      models.MsgInbound,
		Kind:           kind,
		Body:           &body,
		Status:         models.MsgDelivered,
	})
	if err != nil {
		return false, err
	}
	if extID != "" {
		_ = s.messages.SetExternalID(ctx, msg.ID, extID)
		msg.ExternalID = &extID
	}
	if ev.MediaURL != "" {
		mime := gatewayMIME(kind)
		_ = s.messages.CreateAttachment(ctx, repositories.CreateAttachmentParams{
			MessageID: msg.ID,
			URL:       ev.MediaURL,
			MimeType:  &mime,
		})
	}

	preview := body
	if preview == "" {
		preview = "(" + string(kind) + ")"
	}
	_ = s.conversations.TouchLastMessage(ctx, conv.ID, preview)
	_ = s.conversations.IncrementUnread(ctx, conv.ID)
	s.broadcast(realtime.EventMessageNew, channel.WorkspaceID, msg)
	s.emitWebhook(channel.WorkspaceID, webhook.EventMessageReceived, msg)

	if s.autoReplier != nil && body != "" {
		go s.autoReplier.MaybeReply(context.Background(), channel.ID, conv.ID, msg.ID, body)
	}
	return true, nil
}

// upsertContact finds the sender by WhatsApp number — shared with the
// official Cloud API channel, so one customer is one contact whichever
// WhatsApp channel they write to — or creates them.
func (s *GatewayService) upsertContact(ctx context.Context, channel *models.Channel, ev wagateway.Inbound) (*models.Contact, error) {
	source := models.ChannelWhatsApp
	contact, err := s.contacts.FindByExternal(ctx, channel.WorkspaceID, source, ev.From)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return nil, err
	}
	phone := "+" + ev.From
	if contact == nil {
		if byPhone, pErr := s.contacts.FindByPhone(ctx, channel.WorkspaceID, phone); pErr == nil {
			contact = byPhone
		}
	}
	if contact == nil {
		name := ev.PushName
		if name == "" {
			name = phone
		}
		ext := ev.From
		contact, err = s.contacts.Create(ctx, repositories.CreateContactParams{
			WorkspaceID:    channel.WorkspaceID,
			Name:           truncate(name, 120),
			Phone:          &phone,
			ExternalSource: &source,
			ExternalID:     &ext,
		})
		if err != nil {
			return nil, err
		}
		s.emitWebhook(channel.WorkspaceID, webhook.EventContactCreated, contact)
	}
	_ = s.contacts.TouchLastSeen(ctx, contact.ID)
	return contact, nil
}

func gatewayMessageKind(ev wagateway.Inbound) models.MessageKind {
	if ev.MediaURL == "" {
		return models.KindText
	}
	switch ev.MediaType {
	case "video":
		return models.KindVideo
	case "audio", "ptt", "voice":
		return models.KindAudio
	case "document", "file", "pdf":
		return models.KindFile
	default:
		return models.KindImage
	}
}

// gatewayMIME is a coarse MIME type for a gateway attachment; gateways
// report a media category rather than an exact type.
func gatewayMIME(kind models.MessageKind) string {
	switch kind {
	case models.KindVideo:
		return "video/*"
	case models.KindAudio:
		return "audio/*"
	case models.KindFile:
		return "application/octet-stream"
	default:
		return "image/*"
	}
}

// jsonPayload makes sure a raw body can be stored in a JSONB column.
func jsonPayload(raw []byte) []byte {
	if json.Valid(raw) {
		return raw
	}
	b, _ := json.Marshal(map[string]string{"raw": truncate(string(raw), 4000)})
	return b
}

/* -------------------------------- shared -------------------------------- */

func (s *GatewayService) broadcast(eventType, workspaceID string, payload interface{}) {
	if s.broadcaster != nil {
		s.broadcaster.Broadcast(workspaceID, realtime.Event{Type: eventType, Payload: payload})
	}
}

func (s *GatewayService) emitWebhook(workspaceID string, event webhook.Event, data interface{}) {
	if s.webhooks != nil {
		s.webhooks.Emit(workspaceID, event, data)
	}
}

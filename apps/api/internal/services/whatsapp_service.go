package services

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/realtime"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/webhook"
	"github.com/aichat/api/internal/whatsapp"
)

// WhatsApp-related service errors.
var (
	ErrWhatsAppChannelNotFound = errors.New("whatsapp channel not found")
	ErrContactMissingPhone     = errors.New("contact has no phone number")
)

// WhatsAppService coordinates outbound delivery, inbound dispatch and
// status callbacks for the WhatsApp Cloud API.
type WhatsAppService struct {
	pool          *pgxpool.Pool
	channels      *repositories.ChannelRepository
	contacts      *repositories.ContactRepository
	conversations *repositories.ConversationRepository
	messages      *repositories.MessageRepository
	members       *repositories.WorkspaceMemberRepository
	webhookLogs   *repositories.WebhookLogRepository
	encryptor     *crypto.Encryptor
	client        *whatsapp.Client
	broadcaster   realtime.Broadcaster
	autoReplier   AutoReplier
	webhooks      webhook.Dispatcher
	plan          PlanEnforcer

	verifyToken string
	appSecret   string
	uploadDir   string
	publicBase  string
}

// SetPlanEnforcer wires plan-limit enforcement. Optional (nil = no limits).
func (s *WhatsAppService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// SetAutoReplier registers the AI auto-reply hook called after each
// inbound WhatsApp message. Optional — leave nil to disable AI.
func (s *WhatsAppService) SetAutoReplier(r AutoReplier) { s.autoReplier = r }

// SetWebhookDispatcher wires outbound webhook emission. Optional.
func (s *WhatsAppService) SetWebhookDispatcher(d webhook.Dispatcher) {
	if d != nil {
		s.webhooks = d
	}
}

// emitWebhook is a nil-safe helper around the optional dispatcher.
func (s *WhatsAppService) emitWebhook(workspaceID string, event webhook.Event, data interface{}) {
	if s.webhooks != nil {
		s.webhooks.Emit(workspaceID, event, data)
	}
}

// NewWhatsAppService constructs a WhatsAppService.
func NewWhatsAppService(
	pool *pgxpool.Pool,
	channels *repositories.ChannelRepository,
	contacts *repositories.ContactRepository,
	conversations *repositories.ConversationRepository,
	messages *repositories.MessageRepository,
	members *repositories.WorkspaceMemberRepository,
	webhookLogs *repositories.WebhookLogRepository,
	encryptor *crypto.Encryptor,
	client *whatsapp.Client,
	broadcaster realtime.Broadcaster,
	verifyToken, appSecret, uploadDir, publicBase string,
) *WhatsAppService {
	return &WhatsAppService{
		pool: pool, channels: channels, contacts: contacts,
		conversations: conversations, messages: messages,
		members: members, webhookLogs: webhookLogs,
		encryptor: encryptor, client: client,
		broadcaster: broadcaster,
		verifyToken: verifyToken, appSecret: appSecret,
		uploadDir: uploadDir, publicBase: publicBase,
	}
}

/* ------------------------- Webhook verification ------------------------- */

// VerifyWebhook implements Meta's verify-token handshake for `GET /webhooks`.
// Returns the `hub.challenge` echo string on success.
func (s *WhatsAppService) VerifyWebhook(mode, token, challenge string) (string, error) {
	if mode != "subscribe" {
		return "", errors.New("invalid hub.mode")
	}
	if s.verifyToken == "" || token != s.verifyToken {
		return "", errors.New("invalid hub.verify_token")
	}
	return challenge, nil
}

// VerifySignature checks Meta's X-Hub-Signature-256 header (HMAC-SHA256
// of the raw body using the App Secret). Returns nil if the signature is
// valid or if no app secret is configured (development-friendly).
func (s *WhatsAppService) VerifySignature(rawBody []byte, header string) error {
	if s.appSecret == "" {
		return nil
	}
	if !strings.HasPrefix(header, "sha256=") {
		return errors.New("missing sha256= prefix")
	}
	want := strings.TrimPrefix(header, "sha256=")
	mac := hmac.New(sha256.New, []byte(s.appSecret))
	mac.Write(rawBody)
	got := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(got), []byte(want)) {
		return errors.New("signature mismatch")
	}
	return nil
}

/* ----------------------------- Channel connect ------------------------- */

// ConnectInput is the payload used by /workspaces/:id/channels/whatsapp/connect.
type ConnectInput struct {
	WorkspaceID        string
	Name               string
	PhoneNumberID      string
	BusinessAccountID  string
	AccessToken        string
	WebhookVerifyToken string
}

// Connect creates a WhatsApp channel and stores its credentials encrypted.
// Existing channels with the same phone_number_id in this workspace are
// reused so the credentials can be rotated without losing history.
func (s *WhatsAppService) Connect(ctx context.Context, in ConnectInput) (*models.Channel, error) {
	creds := whatsapp.Credentials{
		PhoneNumberID:      strings.TrimSpace(in.PhoneNumberID),
		BusinessAccountID:  strings.TrimSpace(in.BusinessAccountID),
		AccessToken:        strings.TrimSpace(in.AccessToken),
		WebhookVerifyToken: strings.TrimSpace(in.WebhookVerifyToken),
	}
	if err := creds.Validate(); err != nil {
		return nil, err
	}

	// Look for an existing channel in the workspace with the same phone id.
	list, err := s.channels.ListByWorkspace(ctx, in.WorkspaceID)
	if err != nil {
		return nil, err
	}
	var channel *models.Channel
	waCount := 0
	for i := range list {
		if list[i].Type == models.ChannelWhatsApp {
			waCount++
			if list[i].ExternalID != nil && *list[i].ExternalID == creds.PhoneNumberID {
				channel = &list[i]
			}
		}
	}

	if channel == nil {
		// New WhatsApp number → enforce the plan's number limit.
		if err := ensureCanAdd(s.plan, ctx, in.WorkspaceID, ResourceWhatsAppNumbers, waCount); err != nil {
			return nil, err
		}
		phoneID := creds.PhoneNumberID
		channel, err = s.channels.Create(ctx, repositories.CreateChannelParams{
			WorkspaceID: in.WorkspaceID,
			Type:        models.ChannelWhatsApp,
			Name:        in.Name,
			Status:      models.StatusPending,
			ExternalID:  &phoneID,
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

// WebhookURL builds the public webhook URL for documentation/UI display.
func (s *WhatsAppService) WebhookURL() string {
	return strings.TrimRight(s.publicBase, "/") + "/api/webhooks/whatsapp"
}

/* ------------------------------- Send ---------------------------------- */

// DeliverInput is the input for sending an outbound WhatsApp message.
type DeliverInput struct {
	ChannelID      string
	ConversationID string
	SenderUserID   string
	Body           string
}

// Deliver creates the outbound message row, calls Meta and updates the
// row with the provider id + delivery status. On failure the message is
// left as `queued` and a retry goroutine kicks in.
//
// Tenant safety: verifies the sender is an active member of the
// conversation's workspace before any state is mutated. Satisfies the
// ChannelDeliverer interface.
func (s *WhatsAppService) Deliver(ctx context.Context, in DeliverInput) (*models.Message, error) {
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
	if in.ChannelID == "" {
		in.ChannelID = conv.ChannelID
	} else if in.ChannelID != conv.ChannelID {
		return nil, errors.New("channel_id does not match the conversation")
	}
	contact, err := s.contacts.GetByID(ctx, conv.ContactID)
	if err != nil {
		return nil, err
	}
	if contact.Phone == nil || *contact.Phone == "" {
		return nil, ErrContactMissingPhone
	}
	creds, err := whatsapp.LoadCredentials(ctx, s.channels, s.encryptor, in.ChannelID)
	if err != nil {
		return nil, err
	}

	body := strings.TrimSpace(in.Body)
	sender := in.SenderUserID
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: in.ConversationID,
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

	// Try once inline so the caller sees `sent` immediately on the happy path.
	if err := s.attemptDelivery(ctx, msg, creds, *contact.Phone, body); err != nil {
		log.Printf("whatsapp: initial delivery failed (msg=%s): %v", msg.ID, err)
		go s.retryDelivery(msg.ID, conv.WorkspaceID, creds, *contact.Phone, body)
	}
	return msg, nil
}

// attemptDelivery makes a single send attempt and updates the message
// status accordingly. Caller decides whether to retry.
func (s *WhatsAppService) attemptDelivery(ctx context.Context, msg *models.Message, creds *whatsapp.Credentials, to, body string) error {
	externalID, err := s.client.SendText(ctx, creds, to, body)
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

// retryDelivery applies exponential backoff (2s, 8s, 24s).
func (s *WhatsAppService) retryDelivery(messageID, workspaceID string, creds *whatsapp.Credentials, to, body string) {
	delays := []time.Duration{2 * time.Second, 8 * time.Second, 24 * time.Second}
	for i, d := range delays {
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
			log.Printf("whatsapp: retry %d for msg %s: %v", i+1, messageID, err)
		}
		cancel()
	}
	// Final failure.
	_ = s.messages.UpdateStatus(context.Background(), messageID, models.MsgFailed)
	if msg, err := s.messages.GetByID(context.Background(), messageID); err == nil {
		s.broadcast(realtime.EventMessageUpdated, workspaceID, msg)
	}
}

/* --------------------- Incoming webhook dispatch ----------------------- */

// HandleIncoming parses one webhook envelope and dispatches the messages /
// statuses to the inbox. It returns the number of inbound + status events
// processed (purely for logging).
func (s *WhatsAppService) HandleIncoming(ctx context.Context, rawBody []byte, env whatsapp.WebhookEnvelope) (inbound int, statuses int, err error) {
	for _, entry := range env.Entry {
		for _, ch := range entry.Changes {
			if ch.Field != "messages" {
				continue
			}
			phoneID := ch.Value.Metadata.PhoneNumberID
			channel, cErr := s.channels.FindByExternalID(ctx, models.ChannelWhatsApp, phoneID)
			if cErr != nil {
				s.logWebhook(ctx, nil, nil, "messages", http.StatusOK,
					rawBody, fmt.Errorf("no channel for phone_number_id=%s", phoneID))
				continue
			}

			// Mark the channel as connected the first time a webhook arrives.
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

			// --- Inbound messages -----------------------------------------
			profilesByWA := map[string]string{}
			for _, p := range ch.Value.Contacts {
				profilesByWA[p.WAID] = p.Profile.Name
			}

			for _, m := range ch.Value.Messages {
				if err := s.processInboundMessage(ctx, channel, m, profilesByWA[m.From]); err != nil {
					log.Printf("whatsapp: process inbound: %v", err)
				}
				inbound++
			}

			// --- Status updates -------------------------------------------
			for _, st := range ch.Value.Statuses {
				if err := s.processStatus(ctx, st); err != nil {
					log.Printf("whatsapp: process status: %v", err)
				}
				statuses++
			}

			wsID := channel.WorkspaceID
			chID := channel.ID
			s.logWebhook(ctx, &wsID, &chID, "messages", http.StatusOK, rawBody, nil)
		}
	}
	return inbound, statuses, nil
}

func (s *WhatsAppService) processInboundMessage(ctx context.Context, channel *models.Channel, m whatsapp.IncomingMessage, profileName string) error {
	// Upsert contact.
	source := models.ChannelWhatsApp
	contact, err := s.contacts.FindByExternal(ctx, channel.WorkspaceID, source, m.From)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return err
	}
	if contact == nil {
		name := profileName
		if name == "" {
			name = "+" + m.From
		}
		phone := "+" + m.From
		extID := m.From
		contact, err = s.contacts.Create(ctx, repositories.CreateContactParams{
			WorkspaceID:    channel.WorkspaceID,
			Name:           name,
			Phone:          &phone,
			ExternalSource: &source,
			ExternalID:     &extID,
		})
		if err != nil {
			return err
		}
		s.emitWebhook(channel.WorkspaceID, webhook.EventContactCreated, contact)
	}
	_ = s.contacts.TouchLastSeen(ctx, contact.ID)

	// Upsert conversation.
	conv, err := s.conversations.FindOpenByContactChannel(ctx, channel.ID, contact.ID)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return err
	}
	if conv == nil {
		conv, err = s.conversations.Create(ctx, repositories.CreateConversationParams{
			WorkspaceID: channel.WorkspaceID,
			ChannelID:   channel.ID,
			ContactID:   contact.ID,
			Status:      models.ConvOpen,
		})
		if err != nil {
			return err
		}
		s.emitWebhook(channel.WorkspaceID, webhook.EventConversationCreated, conv)
	}

	body, kind := parseMessageBody(m)
	extID := m.ID
	msg, err := s.messages.Create(ctx, repositories.CreateMessageParams{
		ConversationID: conv.ID,
		WorkspaceID:    channel.WorkspaceID,
		Direction:      models.MsgInbound,
		Kind:           kind,
		Body:           &body,
		Status:         models.MsgDelivered,
		SenderUserID:   nil,
	})
	if err != nil {
		return err
	}
	_ = s.messages.SetExternalID(ctx, msg.ID, extID)
	msg.ExternalID = &extID

	preview := body
	if preview == "" {
		preview = "(" + string(kind) + ")"
	}
	_ = s.conversations.TouchLastMessage(ctx, conv.ID, preview)
	_ = s.conversations.IncrementUnread(ctx, conv.ID)

	s.broadcast(realtime.EventMessageNew, channel.WorkspaceID, msg)
	s.emitWebhook(channel.WorkspaceID, webhook.EventMessageReceived, msg)

	// Best-effort async media download for image/document/audio/video.
	if media := mediaFromMessage(m); media != nil {
		go s.downloadMedia(channel.ID, channel.WorkspaceID, msg.ID, media)
	}

	// Fire the AI auto-reply hook if registered. Runs in its own
	// goroutine so we don't block webhook processing.
	if s.autoReplier != nil && body != "" {
		go s.autoReplier.MaybeReply(context.Background(), channel.ID, conv.ID, msg.ID, body)
	}
	return nil
}

func (s *WhatsAppService) processStatus(ctx context.Context, st whatsapp.DeliveryStatus) error {
	mapped, ok := mapStatus(st.Status)
	if !ok {
		return nil
	}
	updated, err := s.messages.UpdateStatusByExternalID(ctx, st.ID, mapped)
	if err != nil {
		return err
	}
	if !updated {
		return nil
	}
	msg, err := s.messages.GetByExternalID(ctx, st.ID)
	if err != nil {
		return err
	}
	s.broadcast(realtime.EventMessageUpdated, msg.WorkspaceID, msg)
	if mapped == models.MsgDelivered {
		s.emitWebhook(msg.WorkspaceID, webhook.EventMessageDelivered, msg)
	}
	return nil
}

func (s *WhatsAppService) downloadMedia(channelID, workspaceID, messageID string, media *whatsapp.MediaPayload) {
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	creds, err := whatsapp.LoadCredentials(ctx, s.channels, s.encryptor, channelID)
	if err != nil {
		log.Printf("whatsapp: media creds: %v", err)
		return
	}
	url, mime, err := s.client.GetMediaInfo(ctx, creds.AccessToken, media.ID)
	if err != nil {
		log.Printf("whatsapp: media info: %v", err)
		return
	}
	data, ctype, err := s.client.DownloadMedia(ctx, creds.AccessToken, url, 10*1024*1024)
	if err != nil {
		log.Printf("whatsapp: media download: %v", err)
		return
	}
	if mime == "" {
		mime = ctype
	}

	dir := filepath.Join(s.uploadDir, "wa")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		log.Printf("whatsapp: mkdir: %v", err)
		return
	}
	name := messageID + extensionFor(mime, media.Filename)
	path := filepath.Join(dir, name)
	if err := os.WriteFile(path, data, 0o644); err != nil {
		log.Printf("whatsapp: write media: %v", err)
		return
	}

	publicURL := strings.TrimRight(s.publicBase, "/") + "/static/wa/" + name
	size := int64(len(data))
	if err := s.messages.CreateAttachment(ctx, repositories.CreateAttachmentParams{
		MessageID: messageID,
		URL:       publicURL,
		MimeType:  &mime,
		SizeBytes: size,
	}); err != nil {
		log.Printf("whatsapp: store attachment: %v", err)
		return
	}
	if msg, err := s.messages.GetByID(ctx, messageID); err == nil {
		s.broadcast(realtime.EventMessageUpdated, workspaceID, msg)
	}
}

/* -------------------------------- helpers ------------------------------- */

func (s *WhatsAppService) broadcast(eventType, workspaceID string, payload interface{}) {
	if s.broadcaster == nil {
		return
	}
	s.broadcaster.Broadcast(workspaceID, realtime.Event{
		Type:    eventType,
		Payload: payload,
	})
}

func (s *WhatsAppService) logWebhook(ctx context.Context, workspaceID, channelID *string, eventType string, statusCode int, payload []byte, sourceErr error) {
	var raw json.RawMessage = payload
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	var errPtr *string
	if sourceErr != nil {
		s := sourceErr.Error()
		errPtr = &s
	}
	_, _ = s.webhookLogs.Create(ctx, repositories.CreateWebhookLogParams{
		WorkspaceID:  workspaceID,
		ChannelID:    channelID,
		Provider:     "whatsapp",
		Direction:    "incoming",
		EventType:    &eventType,
		StatusCode:   statusCode,
		Payload:      raw,
		ErrorMessage: errPtr,
	})
}

// parseMessageBody returns (body, kind) for an inbound message.
func parseMessageBody(m whatsapp.IncomingMessage) (string, models.MessageKind) {
	switch m.Type {
	case "text":
		if m.Text != nil {
			return m.Text.Body, models.KindText
		}
	case "image":
		if m.Image != nil {
			return m.Image.Caption, models.KindImage
		}
	case "document":
		if m.Document != nil {
			body := m.Document.Filename
			if m.Document.Caption != "" {
				body = m.Document.Caption
			}
			return body, models.KindFile
		}
	case "audio":
		if m.Audio != nil {
			return "", models.KindAudio
		}
	case "video":
		if m.Video != nil {
			return m.Video.Caption, models.KindVideo
		}
	case "location":
		if m.Location != nil {
			body := m.Location.Name
			if body == "" {
				body = fmt.Sprintf("%.6f, %.6f", m.Location.Latitude, m.Location.Longitude)
			}
			return "📍 " + body, models.KindSystem
		}
	}
	return "(" + m.Type + ")", models.KindSystem
}

func mediaFromMessage(m whatsapp.IncomingMessage) *whatsapp.MediaPayload {
	switch m.Type {
	case "image":
		return m.Image
	case "document":
		return m.Document
	case "audio":
		return m.Audio
	case "video":
		return m.Video
	}
	return nil
}

func mapStatus(s string) (models.MessageStatus, bool) {
	switch s {
	case "sent":
		return models.MsgSent, true
	case "delivered":
		return models.MsgDelivered, true
	case "read":
		return models.MsgRead, true
	case "failed":
		return models.MsgFailed, true
	}
	return "", false
}

func extensionFor(mime, filename string) string {
	if filename != "" {
		if dot := strings.LastIndex(filename, "."); dot >= 0 {
			return strings.ToLower(filename[dot:])
		}
	}
	switch mime {
	case "image/jpeg":
		return ".jpg"
	case "image/png":
		return ".png"
	case "image/webp":
		return ".webp"
	case "audio/ogg":
		return ".ogg"
	case "audio/mpeg":
		return ".mp3"
	case "video/mp4":
		return ".mp4"
	case "application/pdf":
		return ".pdf"
	}
	return ".bin"
}

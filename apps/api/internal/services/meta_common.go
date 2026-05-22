package services

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/meta"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// upsertMetaContact finds or creates a contact identified by
// (workspace_id, external_source, external_id). When creating, the Meta
// public name is fetched best-effort.
func upsertMetaContact(
	ctx context.Context,
	contacts *repositories.ContactRepository,
	client *meta.Client,
	channel *models.Channel,
	participantID, accessToken string,
) (*models.Contact, bool, error) {
	contact, err := contacts.FindByExternal(ctx, channel.WorkspaceID, channel.Type, participantID)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return nil, false, err
	}
	if contact != nil {
		_ = contacts.TouchLastSeen(ctx, contact.ID)
		return contact, false, nil
	}

	name := ""
	if client != nil && accessToken != "" {
		name = client.FetchUserProfile(ctx, accessToken, participantID)
	}
	if name == "" {
		name = friendlyParticipantName(channel.Type, participantID)
	}
	source := channel.Type
	extID := participantID
	created, err := contacts.Create(ctx, repositories.CreateContactParams{
		WorkspaceID:    channel.WorkspaceID,
		Name:           name,
		ExternalSource: &source,
		ExternalID:     &extID,
	})
	if err != nil {
		return nil, false, err
	}
	return created, true, nil
}

func friendlyParticipantName(t models.ChannelType, id string) string {
	switch t {
	case models.ChannelInstagram:
		return "Instagram " + truncate(id, 8)
	case models.ChannelMessenger:
		return "Messenger " + truncate(id, 8)
	}
	return id
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

// upsertOpenConversation finds an open conversation for (channel, contact)
// or creates a new one.
func upsertOpenConversation(
	ctx context.Context,
	conversations *repositories.ConversationRepository,
	channel *models.Channel,
	contactID string,
) (*models.Conversation, bool, error) {
	conv, err := conversations.FindOpenByContactChannel(ctx, channel.ID, contactID)
	if err != nil && !errors.Is(err, repositories.ErrNotFound) {
		return nil, false, err
	}
	if conv != nil {
		return conv, false, nil
	}
	created, err := conversations.Create(ctx, repositories.CreateConversationParams{
		WorkspaceID: channel.WorkspaceID,
		ChannelID:   channel.ID,
		ContactID:   contactID,
		Status:      models.ConvOpen,
	})
	if err != nil {
		return nil, false, err
	}
	return created, true, nil
}

// bodyFromMetaMessage maps a Messenger-Platform message body onto our
// (body, kind) shape. Text messages are stored as-is; attachments collapse
// onto a single kind based on the first attachment.
func bodyFromMetaMessage(m *meta.IncomingMessage) (string, models.MessageKind) {
	if m == nil {
		return "", models.KindSystem
	}
	if m.Text != "" {
		return m.Text, models.KindText
	}
	if len(m.Attachments) > 0 {
		switch m.Attachments[0].Type {
		case "image":
			return "", models.KindImage
		case "video":
			return "", models.KindVideo
		case "audio":
			return "", models.KindAudio
		case "file":
			return "", models.KindFile
		}
	}
	return "(empty)", models.KindSystem
}

// logMetaWebhook persists one webhook-log row for the Meta integrations.
func logMetaWebhook(
	ctx context.Context,
	logs *repositories.WebhookLogRepository,
	provider string,
	workspaceID, channelID *string,
	eventType string,
	statusCode int,
	payload []byte,
	sourceErr error,
) {
	if logs == nil {
		return
	}
	var raw json.RawMessage = payload
	if len(raw) == 0 {
		raw = json.RawMessage(`{}`)
	}
	var errPtr *string
	if sourceErr != nil {
		msg := sourceErr.Error()
		errPtr = &msg
	}
	_, _ = logs.Create(ctx, repositories.CreateWebhookLogParams{
		WorkspaceID:  workspaceID,
		ChannelID:    channelID,
		Provider:     provider,
		Direction:    "incoming",
		EventType:    &eventType,
		StatusCode:   statusCode,
		Payload:      raw,
		ErrorMessage: errPtr,
	})
}

// Package meta contains primitives shared between Instagram and Facebook
// Messenger integrations: the Messenger-Platform webhook envelope, the
// `/me/messages` send client, and HMAC + verify-token helpers.
//
// WhatsApp uses a different webhook shape and lives under
// `internal/whatsapp` instead.
package meta

import "encoding/json"

// WebhookEnvelope is the top-level payload Meta posts to either the
// Instagram or Page (Messenger) webhook URL.
//
// `Object` distinguishes the two:
//   - "instagram" → entry[i].id is the Instagram Business User id
//   - "page"      → entry[i].id is the Facebook Page id
type WebhookEnvelope struct {
	Object string         `json:"object"`
	Entry  []WebhookEntry `json:"entry"`
}

// WebhookEntry is one IG user / FB page worth of messaging events.
type WebhookEntry struct {
	ID        string             `json:"id"`
	Time      int64              `json:"time"`
	Messaging []MessagingEvent   `json:"messaging,omitempty"`
	Changes   []json.RawMessage  `json:"changes,omitempty"`
}

// MessagingEvent is one event from `entry[].messaging[]`.
//
// Fields are optional and mutually exclusive: a single event carries
// either `message`, `delivery`, `read`, or `reaction`.
type MessagingEvent struct {
	Sender    ParticipantID    `json:"sender"`
	Recipient ParticipantID    `json:"recipient"`
	Timestamp int64            `json:"timestamp"`
	Message   *IncomingMessage `json:"message,omitempty"`
	Delivery  *DeliveryEvent   `json:"delivery,omitempty"`
	Read      *ReadEvent       `json:"read,omitempty"`
	Reaction  *ReactionEvent   `json:"reaction,omitempty"`
}

// ParticipantID is sender/recipient identity.
//
// For Messenger this is a PSID; for Instagram, an IGSID.
type ParticipantID struct {
	ID string `json:"id"`
}

// IncomingMessage is the inbound message body.
type IncomingMessage struct {
	MID         string           `json:"mid"`
	Text        string           `json:"text,omitempty"`
	Attachments []Attachment     `json:"attachments,omitempty"`
	IsEcho      bool             `json:"is_echo,omitempty"`
	ReplyTo     *MessageRef      `json:"reply_to,omitempty"`
	QuickReply  *json.RawMessage `json:"quick_reply,omitempty"`
}

// MessageRef references another inbound message (e.g. reply).
type MessageRef struct {
	MID string `json:"mid"`
}

// Attachment is one inbound attachment (image / video / audio / file).
type Attachment struct {
	Type    string             `json:"type"`
	Payload AttachmentPayload  `json:"payload"`
}

// AttachmentPayload carries the attachment's URL or sticker id.
type AttachmentPayload struct {
	URL        string `json:"url,omitempty"`
	StickerID  int64  `json:"sticker_id,omitempty"`
	IsReusable bool   `json:"is_reusable,omitempty"`
}

// DeliveryEvent reports the recipient device acknowledged messages.
type DeliveryEvent struct {
	MIDs      []string `json:"mids,omitempty"`
	Watermark int64    `json:"watermark"`
}

// ReadEvent reports the recipient read up to `watermark`.
type ReadEvent struct {
	Watermark int64 `json:"watermark"`
}

// ReactionEvent reports a reaction (👍, ❤️…) on a previous message.
type ReactionEvent struct {
	MID      string `json:"mid"`
	Action   string `json:"action"`
	Reaction string `json:"reaction,omitempty"`
	Emoji    string `json:"emoji,omitempty"`
}

// SendMessageRequest is the body of `POST /me/messages`. For Instagram,
// `MessagingProduct` must be set to "instagram"; for Messenger it is
// omitted entirely.
type SendMessageRequest struct {
	MessagingProduct string         `json:"messaging_product,omitempty"`
	Recipient        ParticipantID  `json:"recipient"`
	Message          SendMessageBody `json:"message"`
}

// SendMessageBody currently only carries text. Attachments would extend
// this struct.
type SendMessageBody struct {
	Text string `json:"text"`
}

// SendMessageResponse is Meta's reply on a successful send.
type SendMessageResponse struct {
	RecipientID string `json:"recipient_id"`
	MessageID   string `json:"message_id"`
}

// APIError is Meta's standard error envelope.
type APIError struct {
	Err struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    int    `json:"code"`
		Subcode int    `json:"error_subcode,omitempty"`
	} `json:"error"`
}

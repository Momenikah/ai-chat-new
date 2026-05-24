package whatsapp

import "encoding/json"

// WebhookEnvelope is the top-level payload Meta posts to the webhook URL.
//
//	https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/payload-examples
type WebhookEnvelope struct {
	Object string         `json:"object"`
	Entry  []WebhookEntry `json:"entry"`
}

// WebhookEntry corresponds to a single WhatsApp Business Account.
type WebhookEntry struct {
	ID      string          `json:"id"`
	Changes []WebhookChange `json:"changes"`
}

// WebhookChange wraps one field change ("messages" for inbox events).
type WebhookChange struct {
	Field string             `json:"field"`
	Value WebhookChangeValue `json:"value"`
}

// WebhookChangeValue holds the actual messages / statuses / errors.
type WebhookChangeValue struct {
	MessagingProduct string             `json:"messaging_product"`
	Metadata         WebhookMetadata    `json:"metadata"`
	Contacts         []WebhookContact   `json:"contacts,omitempty"`
	Messages         []IncomingMessage  `json:"messages,omitempty"`
	Statuses         []DeliveryStatus   `json:"statuses,omitempty"`
	Errors           []json.RawMessage  `json:"errors,omitempty"`
}

// WebhookMetadata identifies the receiving phone number.
type WebhookMetadata struct {
	DisplayPhoneNumber string `json:"display_phone_number"`
	PhoneNumberID      string `json:"phone_number_id"`
}

// WebhookContact is the customer's profile snapshot.
type WebhookContact struct {
	Profile struct {
		Name string `json:"name"`
	} `json:"profile"`
	WAID string `json:"wa_id"`
}

// IncomingMessage is one inbound message. Only fields used by the parser
// are typed explicitly; everything else stays in Raw.
type IncomingMessage struct {
	From      string `json:"from"`
	ID        string `json:"id"`
	Timestamp string `json:"timestamp"`
	Type      string `json:"type"`

	Text *struct {
		Body string `json:"body"`
	} `json:"text,omitempty"`

	Image    *MediaPayload    `json:"image,omitempty"`
	Document *MediaPayload    `json:"document,omitempty"`
	Audio    *MediaPayload    `json:"audio,omitempty"`
	Video    *MediaPayload    `json:"video,omitempty"`
	Location *LocationPayload `json:"location,omitempty"`
}

// MediaPayload is the common shape for image/document/audio/video.
type MediaPayload struct {
	ID       string `json:"id"`
	MimeType string `json:"mime_type,omitempty"`
	SHA256   string `json:"sha256,omitempty"`
	Caption  string `json:"caption,omitempty"`
	Filename string `json:"filename,omitempty"`
	Voice    bool   `json:"voice,omitempty"`
}

// LocationPayload is a sent location.
type LocationPayload struct {
	Latitude  float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Name      string  `json:"name,omitempty"`
	Address   string  `json:"address,omitempty"`
}

// DeliveryStatus is one entry from `statuses[]`.
type DeliveryStatus struct {
	ID           string `json:"id"`
	RecipientID  string `json:"recipient_id"`
	Status       string `json:"status"`
	Timestamp    string `json:"timestamp"`
	Conversation *struct {
		ID string `json:"id"`
	} `json:"conversation,omitempty"`
	Pricing *json.RawMessage `json:"pricing,omitempty"`
	Errors  []struct {
		Code    int    `json:"code"`
		Title   string `json:"title"`
		Message string `json:"message"`
	} `json:"errors,omitempty"`
}

// SendTextRequest is the body of POST /{phone_number_id}/messages for text.
type SendTextRequest struct {
	MessagingProduct string         `json:"messaging_product"`
	To               string         `json:"to"`
	Type             string         `json:"type"`
	Text             SendTextBody   `json:"text"`
	Context          *SendContextID `json:"context,omitempty"`
}

// SendTextBody is the text container.
type SendTextBody struct {
	Body       string `json:"body"`
	PreviewURL bool   `json:"preview_url"`
}

// SendContextID is used to reply to a specific inbound message.
type SendContextID struct {
	MessageID string `json:"message_id"`
}

// SendResponse is Meta's reply to a successful send.
type SendResponse struct {
	MessagingProduct string `json:"messaging_product"`
	Contacts         []struct {
		Input string `json:"input"`
		WAID  string `json:"wa_id"`
	} `json:"contacts"`
	Messages []struct {
		ID            string `json:"id"`
		MessageStatus string `json:"message_status"`
	} `json:"messages"`
}

// APIError is Meta's structured error response.
type APIError struct {
	Err struct {
		Message string `json:"message"`
		Type    string `json:"type"`
		Code    int    `json:"code"`
		Subcode int    `json:"error_subcode,omitempty"`
		Data    struct {
			Details string `json:"details,omitempty"`
		} `json:"error_data,omitempty"`
	} `json:"error"`
}

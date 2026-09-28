package models

import "time"

// ChannelType enumerates the supported communication channels.
type ChannelType string

const (
	ChannelWhatsApp  ChannelType = "whatsapp"
	ChannelInstagram ChannelType = "instagram"
	ChannelMessenger ChannelType = "messenger"

	// Unofficial WhatsApp gateways (see internal/wagateway).
	ChannelOneSender  ChannelType = "onesender"
	ChannelStarSender ChannelType = "starsender"
)

// Valid reports whether t is a supported channel type.
func (t ChannelType) Valid() bool {
	switch t {
	case ChannelWhatsApp, ChannelInstagram, ChannelMessenger,
		ChannelOneSender, ChannelStarSender:
		return true
	default:
		return false
	}
}

// IsWhatsApp reports whether the channel delivers to WhatsApp phone
// numbers — the official Cloud API or an unofficial gateway. These share
// phone-based contact routing and the plan's whatsapp_numbers limit.
func (t ChannelType) IsWhatsApp() bool {
	return t == ChannelWhatsApp || t.IsWAGateway()
}

// IsWAGateway reports whether the channel is an unofficial WhatsApp
// gateway (OneSender / StarSender).
func (t ChannelType) IsWAGateway() bool {
	return t == ChannelOneSender || t == ChannelStarSender
}

// ChannelStatus is the connection state of a channel.
type ChannelStatus string

const (
	StatusDisconnected ChannelStatus = "disconnected"
	StatusPending      ChannelStatus = "pending"
	StatusConnected    ChannelStatus = "connected"
	StatusError        ChannelStatus = "error"
)

// Valid reports whether s is a known channel status.
func (s ChannelStatus) Valid() bool {
	switch s {
	case StatusDisconnected, StatusPending, StatusConnected, StatusError:
		return true
	default:
		return false
	}
}

// Channel is a connected communication channel within a workspace.
// Note: credentials are NEVER part of this struct — they live encrypted
// in channel_credentials and are exposed only as the HasCredentials flag.
type Channel struct {
	ID              string        `json:"id"`
	WorkspaceID     string        `json:"workspace_id"`
	Type            ChannelType   `json:"type"`
	Name            string        `json:"name"`
	Status          ChannelStatus `json:"status"`
	ExternalID      *string       `json:"external_id"`
	ErrorMessage    *string       `json:"error_message"`
	LastConnectedAt *time.Time    `json:"last_connected_at"`
	HasCredentials  bool          `json:"has_credentials"`
	CreatedAt       time.Time     `json:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at"`
}

// UploadFile is a stored media/logo file belonging to a workspace.
type UploadFile struct {
	ID           string    `json:"id"`
	WorkspaceID  string    `json:"workspace_id"`
	UploadedBy   *string   `json:"uploaded_by"`
	Kind         string    `json:"kind"`
	OriginalName string    `json:"original_name"`
	StoredPath   string    `json:"-"`
	MimeType     string    `json:"mime_type"`
	SizeBytes    int64     `json:"size_bytes"`
	URL          string    `json:"url"`
	CreatedAt    time.Time `json:"created_at"`
}

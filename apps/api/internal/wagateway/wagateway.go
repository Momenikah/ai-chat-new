// Package wagateway integrates unofficial WhatsApp gateways — services that
// drive a regular WhatsApp account (usually through WhatsApp Web) and
// expose it over a simple HTTP API:
//
//   - OneSender  (onesender.net) — self-hosted instance per customer.
//     POST {instance}/api/v1/messages, `Authorization: Bearer <api key>`.
//   - StarSender (starsender.online, V3) — hosted service.
//     POST https://api.starsender.online/api/send, `Authorization: <device key>`.
//
// Unlike the official Cloud API these gateways do not sign their webhooks,
// so each channel gets a random webhook token that is embedded in the
// callback URL and compared in constant time (see Credentials).
//
// Their webhook payloads are also loosely specified and have changed
// between versions, so ParseWebhook is deliberately tolerant: it accepts
// the common field-name variants and ignores anything it does not
// understand instead of failing the whole delivery.
package wagateway

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/repositories"
)

// Provider identifies a gateway implementation. Values double as the
// channel_type stored for the channel.
type Provider string

const (
	ProviderOneSender  Provider = "onesender"
	ProviderStarSender Provider = "starsender"
)

// Valid reports whether p is a supported provider.
func (p Provider) Valid() bool {
	return p == ProviderOneSender || p == ProviderStarSender
}

// Label is the human-readable provider name.
func (p Provider) Label() string {
	switch p {
	case ProviderOneSender:
		return "OneSender"
	case ProviderStarSender:
		return "StarSender"
	}
	return string(p)
}

// Errors surfaced to callers.
var (
	ErrMissingCredentials = errors.New("wagateway: credentials not configured")
	ErrInvalidCredentials = errors.New("wagateway: api_key is required (and base_url for OneSender)")
)

// Credentials is the cleartext blob stored encrypted in
// channel_credentials for a gateway channel.
type Credentials struct {
	Provider Provider `json:"provider"`
	// BaseURL is the OneSender instance URL (e.g. https://wa.example.com).
	// Empty for StarSender, which uses the operator-configured endpoint.
	BaseURL string `json:"base_url,omitempty"`
	// APIKey is the OneSender API key or the StarSender *device* API key.
	APIKey string `json:"api_key"`
	// WebhookToken authenticates inbound callbacks for this channel.
	WebhookToken string `json:"webhook_token"`
	// PhoneNumber is the WhatsApp number behind the device (display only).
	PhoneNumber string `json:"phone_number,omitempty"`
}

// Validate checks the provider-specific required fields.
func (c Credentials) Validate() error {
	if !c.Provider.Valid() || strings.TrimSpace(c.APIKey) == "" {
		return ErrInvalidCredentials
	}
	if c.Provider == ProviderOneSender && strings.TrimSpace(c.BaseURL) == "" {
		return ErrInvalidCredentials
	}
	if c.WebhookToken == "" {
		return errors.New("wagateway: webhook token missing")
	}
	return nil
}

// TokenMatches compares a presented webhook token in constant time.
func (c Credentials) TokenMatches(presented string) bool {
	if c.WebhookToken == "" || presented == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(c.WebhookToken), []byte(presented)) == 1
}

// NewWebhookToken returns a random URL-safe token (256 bits).
func NewWebhookToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// LoadCredentials decrypts the credential blob for a channel.
func LoadCredentials(
	ctx context.Context,
	channels *repositories.ChannelRepository,
	enc *crypto.Encryptor,
	channelID string,
) (*Credentials, error) {
	ciphertext, nonce, err := channels.GetCredentials(ctx, channelID)
	if err != nil {
		return nil, ErrMissingCredentials
	}
	plain, err := enc.Decrypt(ciphertext, nonce)
	if err != nil {
		return nil, err
	}
	var creds Credentials
	if err := json.Unmarshal(plain, &creds); err != nil {
		return nil, err
	}
	if err := creds.Validate(); err != nil {
		return nil, err
	}
	return &creds, nil
}

// NormalizePhone converts the many phone/JID spellings gateways use into
// bare international digits: "0812-345" → "62812345",
// "62812345@s.whatsapp.net" → "62812345", "+62 812 345" → "62812345".
// Indonesian local numbers (leading 0) are assumed, matching both
// providers' home market.
func NormalizePhone(s string) string {
	if i := strings.IndexAny(s, "@:"); i >= 0 {
		s = s[:i]
	}
	digits := make([]byte, 0, len(s))
	for i := 0; i < len(s); i++ {
		if s[i] >= '0' && s[i] <= '9' {
			digits = append(digits, s[i])
		}
	}
	out := string(digits)
	if strings.HasPrefix(out, "0") {
		out = "62" + strings.TrimLeft(out, "0")
	}
	return out
}

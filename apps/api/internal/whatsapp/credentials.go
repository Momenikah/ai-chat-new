// Package whatsapp wraps Meta's WhatsApp Cloud API: credential storage,
// outbound delivery, webhook verification, and media download.
package whatsapp

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/repositories"
)

// ErrMissingCredentials is returned when a channel has no stored credentials.
var ErrMissingCredentials = errors.New("whatsapp credentials not configured")

// Credentials is the cleartext payload encrypted inside channel_credentials.
//
// `WebhookVerifyToken` is kept here for per-channel validation in case a
// deployment chooses to override the global verify token. `AccessToken` is
// long-lived (Meta system user) or short-lived (24h debug); the channel
// connection flow can be re-run to rotate it.
type Credentials struct {
	PhoneNumberID      string `json:"phone_number_id"`
	BusinessAccountID  string `json:"business_account_id"`
	AccessToken        string `json:"access_token"`
	WebhookVerifyToken string `json:"webhook_verify_token,omitempty"`
}

// Validate checks that the required fields are present.
func (c Credentials) Validate() error {
	if c.PhoneNumberID == "" || c.AccessToken == "" {
		return errors.New("phone_number_id and access_token are required")
	}
	return nil
}

// LoadCredentials decrypts and parses the credential blob for a channel.
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

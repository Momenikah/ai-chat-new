// Package messenger wraps Meta Facebook Messenger Platform: credential
// storage, outbound message delivery, and webhook routing. Wire formats
// are shared with Instagram via `internal/meta`.
package messenger

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/repositories"
)

// ErrMissingCredentials is returned when a channel has no stored credentials.
var ErrMissingCredentials = errors.New("messenger credentials not configured")

// Credentials is the cleartext credential blob stored encrypted inside
// `channel_credentials`. The Messenger Platform authenticates via a
// **Page** access token; `PageID` is stored on `channels.external_id`
// for inbound routing.
type Credentials struct {
	PageID             string `json:"page_id"`
	PageAccessToken    string `json:"page_access_token"`
	WebhookVerifyToken string `json:"webhook_verify_token,omitempty"`
}

// Validate checks that the required fields are present.
func (c Credentials) Validate() error {
	if c.PageID == "" || c.PageAccessToken == "" {
		return errors.New("page_id and page_access_token are required")
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

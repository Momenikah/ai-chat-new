// Package instagram wraps Meta Instagram Messaging: credential storage,
// outbound DM delivery, and webhook routing. The HTTP/Graph wire formats
// are shared with Messenger via `internal/meta`.
package instagram

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/aichat/api/internal/crypto"
	"github.com/aichat/api/internal/repositories"
)

// ErrMissingCredentials is returned when a channel has no stored credentials.
var ErrMissingCredentials = errors.New("instagram credentials not configured")

// Credentials is the cleartext credential blob stored encrypted inside
// `channel_credentials`. The Instagram Messaging API authenticates via
// the linked Facebook **Page** access token; `InstagramBusinessID` is the
// IG account id and is stored on `channels.external_id` for webhook routing.
type Credentials struct {
	InstagramBusinessID string `json:"instagram_business_id"`
	PageID              string `json:"page_id,omitempty"`
	PageAccessToken     string `json:"page_access_token"`
	WebhookVerifyToken  string `json:"webhook_verify_token,omitempty"`
}

// Validate checks that the required fields are present.
func (c Credentials) Validate() error {
	if c.InstagramBusinessID == "" || c.PageAccessToken == "" {
		return errors.New("instagram_business_id and page_access_token are required")
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

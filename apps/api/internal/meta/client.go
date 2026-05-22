package meta

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// DefaultBaseURL is Meta's Graph API root.
const DefaultBaseURL = "https://graph.facebook.com/v20.0"

// MessagingProductInstagram is the constant used in send payloads to flag
// a message as Instagram (omit for Messenger).
const MessagingProductInstagram = "instagram"

// Client is a shared HTTP client for the Messenger Platform — used by
// both Instagram and Messenger services. WhatsApp has its own client in
// `internal/whatsapp` because its send path differs.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient constructs a Client. Empty baseURL falls back to DefaultBaseURL.
func NewClient(baseURL string) *Client {
	if baseURL == "" {
		baseURL = DefaultBaseURL
	}
	return &Client{
		baseURL: baseURL,
		http: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

// BaseURL returns the configured base.
func (c *Client) BaseURL() string { return c.baseURL }

// SendMessage posts to `POST /me/messages` and returns the provider
// message id. Pass `MessagingProductInstagram` for Instagram, empty for
// Messenger.
func (c *Client) SendMessage(ctx context.Context, accessToken, messagingProduct, recipientID, text string) (string, error) {
	req := SendMessageRequest{
		MessagingProduct: messagingProduct,
		Recipient:        ParticipantID{ID: recipientID},
		Message:          SendMessageBody{Text: text},
	}
	resp, err := c.postJSON(ctx, accessToken, "/me/messages", req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", parseAPIError(resp)
	}
	var out SendMessageResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if out.MessageID == "" {
		return "", errors.New("meta: empty message_id in send response")
	}
	return out.MessageID, nil
}

// FetchUserProfile resolves a participant id (PSID/IGSID) into a public
// profile name. Best-effort: returns empty string on error so the caller
// can fall back to the id.
func (c *Client) FetchUserProfile(ctx context.Context, accessToken, participantID string) string {
	url := c.baseURL + "/" + participantID + "?fields=name,username"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return ""
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return ""
	}
	var body struct {
		Name     string `json:"name"`
		Username string `json:"username"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return ""
	}
	if body.Name != "" {
		return body.Name
	}
	return body.Username
}

func (c *Client) postJSON(ctx context.Context, token, path string, body interface{}) (*http.Response, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	return c.http.Do(req)
}

func parseAPIError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	var apiErr APIError
	_ = json.Unmarshal(body, &apiErr)
	if apiErr.Err.Message != "" {
		return fmt.Errorf("meta: %d %s (code=%d)", resp.StatusCode,
			apiErr.Err.Message, apiErr.Err.Code)
	}
	return fmt.Errorf("meta: http %d: %s", resp.StatusCode, string(body))
}

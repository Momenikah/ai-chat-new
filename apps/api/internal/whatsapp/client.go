package whatsapp

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

// DefaultBaseURL is Meta's Graph API root. Override for testing/staging via
// config (env `WHATSAPP_API_BASE_URL`).
const DefaultBaseURL = "https://graph.facebook.com/v20.0"

// Client wraps Meta WhatsApp Cloud API HTTP calls.
type Client struct {
	baseURL string
	http    *http.Client
}

// NewClient constructs a Client. Pass an empty baseURL to use DefaultBaseURL.
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

// SendText posts a text message and returns the provider message id.
func (c *Client) SendText(ctx context.Context, creds *Credentials, to, body string) (string, error) {
	req := SendTextRequest{
		MessagingProduct: "whatsapp",
		To:               sanitizePhone(to),
		Type:             "text",
		Text: SendTextBody{
			Body:       body,
			PreviewURL: false,
		},
	}
	resp, err := c.postJSON(ctx, creds.AccessToken,
		fmt.Sprintf("/%s/messages", creds.PhoneNumberID), req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", parseAPIError(resp)
	}
	var out SendResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return "", err
	}
	if len(out.Messages) == 0 {
		return "", errors.New("whatsapp: empty messages in send response")
	}
	return out.Messages[0].ID, nil
}

// GetMediaInfo resolves a media id into its (signed) download URL + mime.
func (c *Client) GetMediaInfo(ctx context.Context, accessToken, mediaID string) (string, string, error) {
	url := c.baseURL + "/" + mediaID
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return "", "", parseAPIError(resp)
	}
	var meta struct {
		URL      string `json:"url"`
		MimeType string `json:"mime_type"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&meta); err != nil {
		return "", "", err
	}
	return meta.URL, meta.MimeType, nil
}

// DownloadMedia fetches a media URL with the bearer token. The caller is
// expected to bound the byte count via maxBytes (size guard).
func (c *Client) DownloadMedia(ctx context.Context, accessToken, url string, maxBytes int64) ([]byte, string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	resp, err := c.http.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, "", fmt.Errorf("whatsapp: download status %d", resp.StatusCode)
	}
	if maxBytes > 0 && resp.ContentLength > maxBytes {
		return nil, "", fmt.Errorf("whatsapp: media too large (%d bytes)", resp.ContentLength)
	}
	limit := maxBytes
	if limit <= 0 {
		limit = 25 * 1024 * 1024 // hard 25 MB ceiling
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > limit {
		return nil, "", fmt.Errorf("whatsapp: media exceeds %d bytes", limit)
	}
	return data, resp.Header.Get("Content-Type"), nil
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

// parseAPIError reads Meta's error envelope and returns a typed error.
func parseAPIError(resp *http.Response) error {
	var apiErr APIError
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	_ = json.Unmarshal(body, &apiErr)
	if apiErr.Err.Message != "" {
		return fmt.Errorf("whatsapp: %d %s (code=%d)",
			resp.StatusCode, apiErr.Err.Message, apiErr.Err.Code)
	}
	return fmt.Errorf("whatsapp: http %d: %s", resp.StatusCode, string(body))
}

// sanitizePhone removes any non-digit characters from a recipient.
func sanitizePhone(s string) string {
	out := make([]byte, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			out = append(out, byte(r))
		}
	}
	return string(out)
}

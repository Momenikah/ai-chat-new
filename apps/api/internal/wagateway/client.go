package wagateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// DefaultStarSenderURL is StarSender V3's send endpoint.
const DefaultStarSenderURL = "https://api.starsender.online/api/send"

// MediaKind is the attachment type for media messages.
type MediaKind string

const (
	MediaImage    MediaKind = "image"
	MediaDocument MediaKind = "document"
)

// Outbound is a single message to send through a gateway.
type Outbound struct {
	To   string // phone number in any common format
	Text string // body, or caption for media
	// MediaURL, when set, sends a media message fetched by the gateway
	// from this public URL.
	MediaURL  string
	MediaKind MediaKind
}

// Client sends messages through OneSender / StarSender.
type Client struct {
	http          *http.Client
	starSenderURL string
}

// NewClient constructs a Client. httpClient should be SSRF-guarded (see
// netguard) because OneSender instance URLs are supplied by tenants.
func NewClient(httpClient *http.Client, starSenderURL string) *Client {
	if starSenderURL == "" {
		starSenderURL = DefaultStarSenderURL
	}
	return &Client{http: httpClient, starSenderURL: starSenderURL}
}

// Send delivers one message and returns the provider message id, which
// may be empty when the gateway does not report one.
func (c *Client) Send(ctx context.Context, creds *Credentials, msg Outbound) (string, error) {
	to := NormalizePhone(msg.To)
	if to == "" {
		return "", errors.New("wagateway: recipient phone number is empty")
	}
	switch creds.Provider {
	case ProviderOneSender:
		return c.sendOneSender(ctx, creds, to, msg)
	case ProviderStarSender:
		return c.sendStarSender(ctx, creds, to, msg)
	}
	return "", fmt.Errorf("wagateway: unsupported provider %q", creds.Provider)
}

// OneSenderEndpoint derives the messages endpoint from an instance URL,
// accepting either the bare instance or the full endpoint.
func OneSenderEndpoint(base string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if strings.HasSuffix(base, "/api/v1/messages") {
		return base
	}
	return base + "/api/v1/messages"
}

func (c *Client) sendOneSender(ctx context.Context, creds *Credentials, to string, msg Outbound) (string, error) {
	body := map[string]any{
		"to":             to,
		"recipient_type": "individual",
	}
	switch {
	case msg.MediaURL != "" && msg.MediaKind == MediaDocument:
		body["type"] = "document"
		body["document"] = map[string]any{"link": msg.MediaURL}
	case msg.MediaURL != "":
		body["type"] = "image"
		body["image"] = map[string]any{"link": msg.MediaURL, "caption": msg.Text}
	default:
		body["type"] = "text"
		body["text"] = map[string]any{"body": msg.Text}
	}
	return c.post(ctx, OneSenderEndpoint(creds.BaseURL), "Bearer "+creds.APIKey, body)
}

func (c *Client) sendStarSender(ctx context.Context, creds *Credentials, to string, msg Outbound) (string, error) {
	body := map[string]any{
		"messageType": "text",
		"to":          to,
		"body":        msg.Text,
	}
	if msg.MediaURL != "" {
		body["messageType"] = "media"
		body["file"] = msg.MediaURL
	}
	// StarSender expects the raw device key, without a "Bearer" scheme.
	return c.post(ctx, c.starSenderURL, creds.APIKey, body)
}

func (c *Client) post(ctx context.Context, url, auth string, body any) (string, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", auth)

	resp, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("wagateway: http %d: %s", resp.StatusCode, truncate(string(raw), 300))
	}
	return parseSendResponse(raw)
}

// parseSendResponse extracts the message id and detects application-level
// failures that some gateways report with HTTP 200.
func parseSendResponse(raw []byte) (string, error) {
	var out any
	if err := json.Unmarshal(raw, &out); err != nil {
		// Non-JSON 2xx: treat as accepted without an id.
		return "", nil
	}
	obj, _ := out.(map[string]any)
	if obj == nil {
		return "", nil
	}
	if v, ok := obj["success"].(bool); ok && !v {
		return "", fmt.Errorf("wagateway: rejected: %s", errorMessage(obj))
	}
	if v, ok := obj["status"].(bool); ok && !v {
		return "", fmt.Errorf("wagateway: rejected: %s", errorMessage(obj))
	}
	if code, ok := obj["code"].(float64); ok && code >= 400 {
		return "", fmt.Errorf("wagateway: rejected (code %d): %s", int(code), errorMessage(obj))
	}
	if e, ok := obj["error"]; ok && e != nil && e != false && e != "" {
		return "", fmt.Errorf("wagateway: rejected: %s", errorMessage(obj))
	}
	id := firstString(obj,
		"messages.0.id", "id", "message_id", "messageId",
		"data.id", "data.message_id", "data.messageId", "data.0.id", "data.key.id",
		"key.id")
	return id, nil
}

func errorMessage(obj map[string]any) string {
	if s := firstString(obj, "message", "error", "error.message", "data.message", "errors.0.message"); s != "" {
		return truncate(s, 300)
	}
	b, _ := json.Marshal(obj)
	return truncate(string(b), 300)
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

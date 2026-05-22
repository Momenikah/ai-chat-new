package broadcast

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

// Sender wraps Meta Graph API HTTP calls used by the worker.
type Sender struct {
	whatsAppBaseURL string
	metaBaseURL     string
	http            *http.Client
}

// NewSender constructs a Sender. Defaults to Graph API v20.0.
func NewSender(whatsAppBaseURL, metaBaseURL string) *Sender {
	if whatsAppBaseURL == "" {
		whatsAppBaseURL = "https://graph.facebook.com/v20.0"
	}
	if metaBaseURL == "" {
		metaBaseURL = "https://graph.facebook.com/v20.0"
	}
	return &Sender{
		whatsAppBaseURL: whatsAppBaseURL,
		metaBaseURL:     metaBaseURL,
		http:            &http.Client{Timeout: 20 * time.Second},
	}
}

// Send dispatches the job through the correct channel and returns the
// provider message id.
func (s *Sender) Send(ctx context.Context, j Job) (string, error) {
	switch j.ChannelKind {
	case "whatsapp":
		return s.sendWhatsApp(ctx, j)
	case "instagram", "messenger":
		return s.sendMessenger(ctx, j)
	}
	return "", fmt.Errorf("unsupported channel_kind %q", j.ChannelKind)
}

func (s *Sender) sendWhatsApp(ctx context.Context, j Job) (string, error) {
	if j.PhoneNumberID == "" {
		return "", errors.New("missing phone_number_id for whatsapp job")
	}
	body := map[string]any{
		"messaging_product": "whatsapp",
		"to":                sanitizePhone(j.RecipientTo),
		"type":              "text",
		"text":              map[string]any{"body": j.Body, "preview_url": false},
	}
	url := s.whatsAppBaseURL + "/" + j.PhoneNumberID + "/messages"
	return s.postAndParse(ctx, url, j.AccessToken, body, "messages.0.id")
}

func (s *Sender) sendMessenger(ctx context.Context, j Job) (string, error) {
	body := map[string]any{
		"recipient": map[string]any{"id": j.RecipientTo},
		"message":   map[string]any{"text": j.Body},
	}
	if j.MessagingProduct != "" {
		body["messaging_product"] = j.MessagingProduct
	}
	url := s.metaBaseURL + "/me/messages"
	return s.postAndParse(ctx, url, j.AccessToken, body, "message_id")
}

// postAndParse posts the JSON body with Bearer auth and extracts the
// provider message id via a dotted field path.
//
// Supported paths:
//   - "message_id"      (Messenger / Instagram response shape)
//   - "messages.0.id"   (WhatsApp response shape)
func (s *Sender) postAndParse(ctx context.Context, url, token string, body any, path string) (string, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(buf))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := s.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("meta: http %d: %s", resp.StatusCode, string(raw))
	}
	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil {
		return "", err
	}
	id, ok := extractField(out, path)
	if !ok || id == "" {
		return "", fmt.Errorf("meta: no message id in response: %s", string(raw))
	}
	return id, nil
}

// extractField walks a dotted path through nested map/array JSON.
func extractField(v any, path string) (string, bool) {
	cur := v
	start := 0
	for i := 0; i <= len(path); i++ {
		if i < len(path) && path[i] != '.' {
			continue
		}
		seg := path[start:i]
		start = i + 1
		switch node := cur.(type) {
		case map[string]any:
			cur = node[seg]
		case []any:
			var idx int
			_, err := fmt.Sscanf(seg, "%d", &idx)
			if err != nil || idx < 0 || idx >= len(node) {
				return "", false
			}
			cur = node[idx]
		default:
			return "", false
		}
	}
	if s, ok := cur.(string); ok {
		return s, true
	}
	return "", false
}

func sanitizePhone(s string) string {
	out := make([]byte, 0, len(s))
	for _, r := range s {
		if r >= '0' && r <= '9' {
			out = append(out, byte(r))
		}
	}
	return string(out)
}

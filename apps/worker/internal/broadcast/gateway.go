package broadcast

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

// Unofficial WhatsApp gateway sends for broadcasts. Mirrors the API's
// internal/wagateway client (separate Go module); keep request shapes in
// sync with it.

const defaultStarSenderURL = "https://api.starsender.online/api/send"

func (s *Sender) sendGateway(ctx context.Context, j Job) (string, error) {
	to := normalizeGatewayPhone(j.RecipientTo)
	if to == "" {
		return "", errors.New("gateway: recipient phone number is empty")
	}
	switch j.ChannelKind {
	case "onesender":
		if j.GatewayURL == "" {
			return "", errors.New("gateway: missing OneSender instance URL")
		}
		body := map[string]any{
			"to":             to,
			"recipient_type": "individual",
			"type":           "text",
			"text":           map[string]any{"body": j.Body},
		}
		return s.postGateway(ctx, oneSenderEndpoint(j.GatewayURL), "Bearer "+j.AccessToken, body)
	case "starsender":
		body := map[string]any{"messageType": "text", "to": to, "body": j.Body}
		// StarSender expects the raw device key, without a scheme.
		return s.postGateway(ctx, s.starSenderURL, j.AccessToken, body)
	}
	return "", fmt.Errorf("gateway: unsupported kind %q", j.ChannelKind)
}

func oneSenderEndpoint(base string) string {
	base = strings.TrimRight(strings.TrimSpace(base), "/")
	if strings.HasSuffix(base, "/api/v1/messages") {
		return base
	}
	return base + "/api/v1/messages"
}

func (s *Sender) postGateway(ctx context.Context, url, auth string, body any) (string, error) {
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
	resp, err := s.gatewayHTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 64*1024))
	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("gateway: http %d: %s", resp.StatusCode, truncateStr(string(raw), 300))
	}

	var out map[string]any
	if err := json.Unmarshal(raw, &out); err != nil || out == nil {
		return "", nil // accepted, no id reported
	}
	failed := false
	if v, ok := out["success"].(bool); ok && !v {
		failed = true
	}
	if v, ok := out["status"].(bool); ok && !v {
		failed = true
	}
	if code, ok := out["code"].(float64); ok && code >= 400 {
		failed = true
	}
	if e, ok := out["error"]; ok && e != nil && e != false && e != "" {
		failed = true
	}
	if failed {
		return "", fmt.Errorf("gateway: rejected: %s", truncateStr(string(raw), 300))
	}
	for _, path := range []string{"messages.0.id", "id", "message_id", "data.id", "data.message_id"} {
		if id, ok := extractField(out, path); ok && id != "" {
			return id, nil
		}
	}
	return "", nil
}

// normalizeGatewayPhone mirrors wagateway.NormalizePhone in the API.
func normalizeGatewayPhone(s string) string {
	if i := strings.IndexAny(s, "@:"); i >= 0 {
		s = s[:i]
	}
	out := sanitizePhone(s)
	if strings.HasPrefix(out, "0") {
		out = "62" + strings.TrimLeft(out, "0")
	}
	return out
}

func truncateStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}

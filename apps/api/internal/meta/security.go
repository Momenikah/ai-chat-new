package meta

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"strings"
)

// VerifyChallenge implements Meta's verify-token handshake.
// Returns the `hub.challenge` echo string on success.
func VerifyChallenge(mode, token, challenge, expected string) (string, error) {
	if mode != "subscribe" {
		return "", errors.New("invalid hub.mode")
	}
	if expected == "" || token != expected {
		return "", errors.New("invalid hub.verify_token")
	}
	return challenge, nil
}

// VerifyHMAC validates Meta's `X-Hub-Signature-256` header against the
// raw request body. An empty `appSecret` makes this a no-op (intended for
// development).
func VerifyHMAC(rawBody []byte, header, appSecret string) error {
	if appSecret == "" {
		return nil
	}
	if !strings.HasPrefix(header, "sha256=") {
		return errors.New("missing sha256= prefix")
	}
	want := strings.TrimPrefix(header, "sha256=")
	mac := hmac.New(sha256.New, []byte(appSecret))
	mac.Write(rawBody)
	got := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(got), []byte(want)) {
		return errors.New("signature mismatch")
	}
	return nil
}

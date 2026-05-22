package webhook

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
)

// SignatureHeader is the HTTP header that carries the HMAC of the body.
// Format: `sha256=<hex>` so receivers can future-proof against algo
// rotation by sniffing the prefix.
const SignatureHeader = "X-AIChat-Signature"

// EventHeader carries the event name (also present in the body but
// useful for routing without parsing JSON).
const EventHeader = "X-AIChat-Event"

// DeliveryHeader carries the unique envelope ID (used for receiver-side
// dedupe across retries — every retry sends the SAME id).
const DeliveryHeader = "X-AIChat-Delivery"

// Sign computes HMAC-SHA256 of `body` keyed by `secret` and returns the
// value to place in SignatureHeader.
func Sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

// Verify constant-time-compares a signature header to what we'd produce
// for the same body + secret. Receivers reuse this to validate.
func Verify(secret string, body []byte, signature string) bool {
	expected := Sign(secret, body)
	return hmac.Equal([]byte(expected), []byte(signature))
}

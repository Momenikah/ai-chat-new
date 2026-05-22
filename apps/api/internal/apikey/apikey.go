// Package apikey mints + hashes developer API keys for the public API.
//
// A key looks like `aic_<32 url-safe base64 chars>` so the prefix
// uniquely identifies our keys (handy when a customer accidentally
// commits one to a public repo and we need to scan for leaks).
//
// We never persist the plaintext. The DB stores SHA-256 of the entire
// key (prefix + secret) plus the visible prefix for display in the
// dashboard. Verification is a constant-time hash compare.
package apikey

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"strings"
)

// Prefix is the constant prefix on every minted key.
const Prefix = "aic_"

// PrefixDisplay is how many leading characters of the plaintext we keep
// in the DB for display ("aic_xQwL…").
const PrefixDisplay = 12

// ErrInvalidFormat is returned by Parse when the input doesn't look like
// one of our keys.
var ErrInvalidFormat = errors.New("apikey: invalid format")

// Generated bundles a freshly-minted key with its derived hash and
// human-readable prefix. The plaintext should be shown to the operator
// exactly once and then discarded.
type Generated struct {
	Plaintext string // returned to the operator once
	Hash      string // stored in api_keys.key_hash
	Prefix    string // stored in api_keys.prefix for display
}

// Generate mints a new key with 32 random bytes (URL-safe base64,
// trailing `=` stripped). That gives ~256 bits of entropy.
func Generate() (*Generated, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return nil, err
	}
	secret := strings.TrimRight(base64.URLEncoding.EncodeToString(buf), "=")
	plaintext := Prefix + secret
	return &Generated{
		Plaintext: plaintext,
		Hash:      Hash(plaintext),
		Prefix:    visiblePrefix(plaintext),
	}, nil
}

// Hash returns SHA-256(plaintext) hex-encoded — exactly what the DB stores.
func Hash(plaintext string) string {
	sum := sha256.Sum256([]byte(plaintext))
	return hex.EncodeToString(sum[:])
}

// Parse extracts the bearer token from common header forms. It accepts
// the literal `aic_…` token, the `Bearer aic_…` form, and is tolerant of
// surrounding whitespace.
func Parse(header string) (string, error) {
	s := strings.TrimSpace(header)
	if s == "" {
		return "", ErrInvalidFormat
	}
	if strings.HasPrefix(s, "Bearer ") || strings.HasPrefix(s, "bearer ") {
		s = strings.TrimSpace(s[7:])
	}
	if !strings.HasPrefix(s, Prefix) || len(s) < len(Prefix)+16 {
		return "", ErrInvalidFormat
	}
	return s, nil
}

func visiblePrefix(plaintext string) string {
	if len(plaintext) <= PrefixDisplay {
		return plaintext
	}
	return plaintext[:PrefixDisplay]
}

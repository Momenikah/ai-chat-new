package meta

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func sign(secret string, body []byte) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write(body)
	return "sha256=" + hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyHMAC(t *testing.T) {
	body := []byte(`{"object":"page"}`)
	good := sign("app-secret", body)

	if err := VerifyHMAC(body, good, "app-secret"); err != nil {
		t.Fatalf("valid signature rejected: %v", err)
	}
	for name, header := range map[string]string{
		"wrong secret":   sign("other", body),
		"missing prefix": good[len("sha256="):],
		"empty":          "",
	} {
		if err := VerifyHMAC(body, header, "app-secret"); err == nil {
			t.Errorf("%s: accepted, want error", name)
		}
	}
	if err := VerifyHMAC([]byte(`{"object":"forged"}`), good, "app-secret"); err == nil {
		t.Error("tampered body accepted")
	}
}

func TestVerifyChallenge(t *testing.T) {
	if got, err := VerifyChallenge("subscribe", "tok", "123", "tok"); err != nil || got != "123" {
		t.Fatalf("valid handshake = %q, %v", got, err)
	}
	if _, err := VerifyChallenge("subscribe", "", "123", ""); err == nil {
		t.Fatal("empty expected token must never verify")
	}
	if _, err := VerifyChallenge("subscribe", "bad", "123", "tok"); err == nil {
		t.Fatal("wrong token accepted")
	}
	if _, err := VerifyChallenge("unsubscribe", "tok", "123", "tok"); err == nil {
		t.Fatal("wrong mode accepted")
	}
}

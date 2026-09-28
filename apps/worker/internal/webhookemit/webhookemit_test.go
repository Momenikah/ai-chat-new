package webhookemit

import "testing"

func TestSignKnownAnswer(t *testing.T) {
	// Must match the API's webhook.Sign known answer.
	const want = "sha256=2faa36cbbdb4267aba5c8416c1692e40f492cb51b2b6c53ea7b44b5bfa9f2bf9"
	if got := sign("whsec_test", []byte(`{"event":"message.received"}`)); got != want {
		t.Fatalf("sign() = %q, want %q", got, want)
	}
}

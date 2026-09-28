package webhook

import "testing"

func TestSignVerifyRoundTrip(t *testing.T) {
	body := []byte(`{"event":"message.received"}`)
	sig := Sign("whsec_test", body)
	// Known answer computed independently with:
	//   printf '%s' "$body" | openssl dgst -sha256 -hmac whsec_test
	// so receivers in other languages can rely on the exact format.
	const want = "sha256=2faa36cbbdb4267aba5c8416c1692e40f492cb51b2b6c53ea7b44b5bfa9f2bf9"
	if sig != want {
		t.Fatalf("Sign() = %q, want %q", sig, want)
	}
	if !Verify("whsec_test", body, sig) {
		t.Fatal("Verify rejected a valid signature")
	}
	if Verify("other-secret", body, sig) {
		t.Fatal("Verify accepted a signature made with a different secret")
	}
	if Verify("whsec_test", []byte(`{"event":"tampered"}`), sig) {
		t.Fatal("Verify accepted a tampered body")
	}
}

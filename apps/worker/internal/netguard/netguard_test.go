package webhookemit

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
	"time"
)

func TestIsBlockedIP(t *testing.T) {
	for _, s := range []string{"127.0.0.1", "10.0.0.1", "169.254.169.254", "::1", "::ffff:192.168.0.1"} {
		if !isBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("isBlockedIP(%s) = false, want true", s)
		}
	}
	for _, s := range []string{"8.8.8.8", "2606:4700:4700::1111"} {
		if isBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("isBlockedIP(%s) = true, want false", s)
		}
	}
}

func TestGuardedClientBlocksLoopback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	defer srv.Close()

	if _, err := newHTTPClient(2*time.Second, false).Get(srv.URL); !errors.Is(err, errBlockedAddress) {
		t.Fatalf("guarded client: err=%v, want errBlockedAddress", err)
	}
	resp, err := newHTTPClient(2*time.Second, true).Get(srv.URL)
	if err != nil {
		t.Fatalf("unguarded client: %v", err)
	}
	resp.Body.Close()
}

func TestSignKnownAnswer(t *testing.T) {
	// Must match the API's webhook.Sign known answer.
	const want = "sha256=2faa36cbbdb4267aba5c8416c1692e40f492cb51b2b6c53ea7b44b5bfa9f2bf9"
	if got := sign("whsec_test", []byte(`{"event":"message.received"}`)); got != want {
		t.Fatalf("sign() = %q, want %q", got, want)
	}
}

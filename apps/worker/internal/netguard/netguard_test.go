package netguard

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
		if !IsBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("IsBlockedIP(%s) = false, want true", s)
		}
	}
	for _, s := range []string{"8.8.8.8", "2606:4700:4700::1111"} {
		if IsBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("IsBlockedIP(%s) = true, want false", s)
		}
	}
}

func TestGuardedClientBlocksLoopback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	defer srv.Close()

	if _, err := NewHTTPClient(2*time.Second, false).Get(srv.URL); !errors.Is(err, ErrBlockedAddress) {
		t.Fatalf("guarded client: err=%v, want ErrBlockedAddress", err)
	}
	resp, err := NewHTTPClient(2*time.Second, true).Get(srv.URL)
	if err != nil {
		t.Fatalf("unguarded client: %v", err)
	}
	resp.Body.Close()
}

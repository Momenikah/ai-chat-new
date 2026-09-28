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
	blocked := []string{
		"127.0.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1",
		"169.254.169.254", "0.0.0.0", "100.64.0.1", "224.0.0.1",
		"255.255.255.255", "::1", "::", "fc00::1", "fe80::1",
		"::ffff:127.0.0.1", "::ffff:10.0.0.1", "64:ff9b::a00:1",
	}
	for _, s := range blocked {
		if !IsBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("IsBlockedIP(%s) = false, want true", s)
		}
	}

	allowed := []string{"8.8.8.8", "1.1.1.1", "157.240.1.35", "2606:4700:4700::1111"}
	for _, s := range allowed {
		if IsBlockedIP(netip.MustParseAddr(s)) {
			t.Errorf("IsBlockedIP(%s) = true, want false", s)
		}
	}
}

func TestValidateURL(t *testing.T) {
	cases := []struct {
		url     string
		wantErr bool
	}{
		{"https://hooks.example.com/n8n/abc", false},
		{"http://8.8.8.8/hook", false},
		{"ftp://example.com", true},
		{"not a url", true},
		{"https://", true},
		{"http://localhost:5678/webhook", true},
		{"http://LOCALHOST./x", true},
		{"http://api.localhost/x", true},
		{"http://metadata.google.internal/", true},
		{"http://127.0.0.1:6379", true},
		{"http://[::1]:8080", true},
		{"http://169.254.169.254/latest/meta-data", true},
		{"http://10.0.0.5/hook", true},
	}
	for _, tc := range cases {
		err := ValidateURL(tc.url)
		if (err != nil) != tc.wantErr {
			t.Errorf("ValidateURL(%q) err=%v, wantErr=%v", tc.url, err, tc.wantErr)
		}
	}
}

func TestNewHTTPClientBlocksLoopback(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	guarded := NewHTTPClient(2*time.Second, false)
	_, err := guarded.Get(srv.URL)
	if err == nil || !errors.Is(err, ErrBlockedAddress) {
		t.Fatalf("guarded client reached loopback server, err=%v", err)
	}

	open := NewHTTPClient(2*time.Second, true)
	resp, err := open.Get(srv.URL)
	if err != nil {
		t.Fatalf("unguarded client failed: %v", err)
	}
	resp.Body.Close()
}

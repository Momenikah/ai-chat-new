// Package netguard protects outbound HTTP calls to tenant-supplied URLs
// (webhook endpoints, n8n) against SSRF.
//
// Without it, any workspace admin could register a webhook pointing at
// http://127.0.0.1:6379, http://169.254.169.254/ (cloud metadata) or any
// other host on the API's private network and read the response body back
// through the delivery log viewer.
//
// The check runs inside the dialer's Control hook, i.e. against the IP
// that is actually being connected to after DNS resolution. That also
// defeats DNS-rebinding and redirect tricks, which a validate-the-hostname-
// once approach cannot.
package netguard

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/netip"
	"net/url"
	"strings"
	"syscall"
	"time"
)

// ErrBlockedAddress is returned when a destination resolves to an address
// that tenants are not allowed to reach.
var ErrBlockedAddress = errors.New("destination address is not allowed")

// blockedPrefixes lists special-purpose ranges that are never valid
// targets for a public webhook, on top of the stdlib predicates checked in
// IsBlockedIP (loopback, private, link-local, multicast, unspecified).
var blockedPrefixes = []netip.Prefix{
	netip.MustParsePrefix("0.0.0.0/8"),       // "this network"
	netip.MustParsePrefix("100.64.0.0/10"),   // carrier-grade NAT
	netip.MustParsePrefix("192.0.0.0/24"),    // IETF protocol assignments
	netip.MustParsePrefix("192.0.2.0/24"),    // TEST-NET-1
	netip.MustParsePrefix("198.18.0.0/15"),   // benchmarking
	netip.MustParsePrefix("198.51.100.0/24"), // TEST-NET-2
	netip.MustParsePrefix("203.0.113.0/24"),  // TEST-NET-3
	netip.MustParsePrefix("240.0.0.0/4"),     // reserved + broadcast
	netip.MustParsePrefix("64:ff9b::/96"),    // NAT64 (can map to private v4)
	netip.MustParsePrefix("2001:db8::/32"),   // documentation
}

// IsBlockedIP reports whether ip is loopback, private, link-local,
// multicast, unspecified or another special-purpose range.
func IsBlockedIP(ip netip.Addr) bool {
	if !ip.IsValid() {
		return true
	}
	ip = ip.Unmap() // treat ::ffff:10.0.0.1 exactly like 10.0.0.1
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() ||
		ip.IsInterfaceLocalMulticast() || ip.IsMulticast() {
		return true
	}
	for _, p := range blockedPrefixes {
		if p.Contains(ip) {
			return true
		}
	}
	return false
}

// ValidateURL performs the cheap, pre-resolution checks used when a URL is
// saved: scheme must be http(s), host must be present, and literal IPs or
// obviously-internal hostnames are rejected. The dialer still re-checks the
// resolved address at delivery time.
func ValidateURL(raw string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return fmt.Errorf("invalid url")
	}
	host := strings.TrimSuffix(strings.ToLower(u.Hostname()), ".")
	if host == "" {
		return fmt.Errorf("invalid url")
	}
	if host == "localhost" || strings.HasSuffix(host, ".localhost") ||
		strings.HasSuffix(host, ".internal") || strings.HasSuffix(host, ".local") {
		return ErrBlockedAddress
	}
	if ip, err := netip.ParseAddr(host); err == nil && IsBlockedIP(ip) {
		return ErrBlockedAddress
	}
	return nil
}

// control is a net.Dialer Control hook that rejects blocked addresses.
func control(_, address string, _ syscall.RawConn) error {
	host, _, err := net.SplitHostPort(address)
	if err != nil {
		return err
	}
	ip, err := netip.ParseAddr(host)
	if err != nil || IsBlockedIP(ip) {
		return fmt.Errorf("%w: %s", ErrBlockedAddress, host)
	}
	return nil
}

// NewHTTPClient returns an http.Client for calling tenant-supplied URLs.
//
// When allowPrivate is false every connection is checked against
// IsBlockedIP after DNS resolution. Environment proxies are ignored in that
// mode, since the dialer would otherwise only ever see the proxy's address.
// allowPrivate=true is meant for local development, where webhook targets
// such as a local n8n instance legitimately live on localhost.
func NewHTTPClient(timeout time.Duration, allowPrivate bool) *http.Client {
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	if !allowPrivate {
		dialer.Control = control
		transport.Proxy = nil
	}
	transport.DialContext = func(ctx context.Context, network, addr string) (net.Conn, error) {
		return dialer.DialContext(ctx, network, addr)
	}
	return &http.Client{
		Timeout:   timeout,
		Transport: transport,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			if len(via) >= 3 {
				return errors.New("stopped after 3 redirects")
			}
			return nil
		},
	}
}

package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/ratelimit"
	"github.com/aichat/api/internal/utils"
)

func newTestEcho() *echo.Echo {
	e := echo.New()
	e.Validator = utils.NewValidator()
	return e
}

func postJSON(e *echo.Echo, h echo.HandlerFunc, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/", strings.NewReader(body))
	req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
	req.RemoteAddr = "203.0.113.7:1234"
	rec := httptest.NewRecorder()
	_ = h(e.NewContext(req, rec))
	return rec
}

// The throttled paths must short-circuit before touching the auth service,
// so a nil service is enough here.

func TestLoginRejectedWhenEmailHasTooManyFailures(t *testing.T) {
	failures := ratelimit.New(ratelimit.NewMemoryStore(), "loginfail", 2, time.Minute)
	failures.Hit(context.Background(), "victim@example.com")
	failures.Hit(context.Background(), "victim@example.com")

	h := &AuthHandler{}
	h.SetThrottle(AuthThrottle{LoginFailures: failures})

	// Email is normalised, so case variants share the bucket.
	rec := postJSON(newTestEcho(), h.Login, `{"email":"Victim@Example.com","password":"x"}`)
	if rec.Code != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429; body=%s", rec.Code, rec.Body)
	}
	if rec.Header().Get("Retry-After") == "" {
		t.Fatal("missing Retry-After header")
	}
}

func TestLoginAndRegisterRejectedWhenIPOverLimit(t *testing.T) {
	perIP := ratelimit.New(ratelimit.NewMemoryStore(), "authrl", 1, time.Minute)
	h := &AuthHandler{}
	h.SetThrottle(AuthThrottle{PerIP: perIP})
	e := newTestEcho()

	// Use up the single allowed request with an invalid body (fails
	// validation before reaching the service).
	if rec := postJSON(e, h.Login, `{}`); rec.Code == http.StatusTooManyRequests {
		t.Fatal("first login attempt throttled")
	}
	if rec := postJSON(e, h.Login, `{}`); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second login status = %d, want 429", rec.Code)
	}

	// Register has its own bucket.
	if rec := postJSON(e, h.Register, `{}`); rec.Code == http.StatusTooManyRequests {
		t.Fatal("register throttled by login bucket")
	}
	if rec := postJSON(e, h.Register, `{}`); rec.Code != http.StatusTooManyRequests {
		t.Fatalf("second register status = %d, want 429", rec.Code)
	}
}

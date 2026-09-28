package middleware

import (
	"context"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/apikey"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/ratelimit"
	"github.com/aichat/api/internal/repositories"
	"github.com/aichat/api/internal/utils"
)

// Context keys specific to API-key authenticated requests.
const (
	ContextKeyAPIKeyID = "ctx_api_key_id"
)

// APIKeyMiddleware authenticates public-API requests via a developer API
// key, enforces a Redis-backed per-key rate limit, and records every
// request to api_usage_logs.
//
// On success it populates ContextKeyWorkspaceID (so public handlers reuse
// the same WorkspaceID(c) accessor as the dashboard handlers) plus
// ContextKeyAPIKeyID.
type APIKeyMiddleware struct {
	keys       *repositories.APIKeyRepository
	workspaces *repositories.WorkspaceRepository
	limiter    *ratelimit.Limiter
}

// NewAPIKeyMiddleware constructs an APIKeyMiddleware. A ratePerMinute <= 0
// or a nil store disables rate limiting.
func NewAPIKeyMiddleware(
	keys *repositories.APIKeyRepository,
	workspaces *repositories.WorkspaceRepository,
	store ratelimit.Store,
	ratePerMinute int,
) *APIKeyMiddleware {
	return &APIKeyMiddleware{
		keys:       keys,
		workspaces: workspaces,
		limiter:    ratelimit.New(store, "apirl", ratePerMinute, time.Minute),
	}
}

// Authenticate is the middleware entrypoint for the public API group.
func (m *APIKeyMiddleware) Authenticate() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			start := time.Now()

			raw := c.Request().Header.Get("Authorization")
			if raw == "" {
				raw = c.Request().Header.Get("X-API-Key")
			}
			token, err := apikey.Parse(raw)
			if err != nil {
				return m.unauthorized(c, "API key tidak ditemukan atau formatnya salah")
			}

			ctx := c.Request().Context()
			key, err := m.keys.FindActiveByHash(ctx, apikey.Hash(token))
			if err != nil {
				return m.unauthorized(c, "API key tidak valid atau sudah dicabut")
			}

			// Rate limit per key (fixed window per minute).
			if allowed, retryAfter := m.limiter.Allow(ctx, key.ID); !allowed {
				SetRetryAfter(c, retryAfter)
				return utils.Error(c, http.StatusTooManyRequests,
					"rate_limited", "Batas rate limit API terlampaui, coba lagi nanti")
			}

			// Suspended workspaces are frozen for API keys too, not only
			// for dashboard sessions.
			if m.workspaces != nil {
				if ws, err := m.workspaces.GetByID(ctx, key.WorkspaceID); err == nil && ws.IsSuspended() {
					return utils.Error(c, http.StatusForbidden,
						"workspace_suspended", "Workspace ini sedang ditangguhkan. Hubungi dukungan.")
				}
			}

			c.Set(ContextKeyWorkspaceID, key.WorkspaceID)
			c.Set(ContextKeyAPIKeyID, key.ID)

			// Best-effort: never block the request on bookkeeping.
			go func(id string) {
				bg, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()
				_ = m.keys.TouchLastUsed(bg, id, time.Now())
			}(key.ID)

			err = next(c)

			m.logUsage(key, c, start, err)
			return err
		}
	}
}

// SetRetryAfter writes a Retry-After header rounded up to whole seconds.
func SetRetryAfter(c echo.Context, d time.Duration) {
	secs := int(math.Ceil(d.Seconds()))
	if secs < 1 {
		secs = 1
	}
	c.Response().Header().Set("Retry-After", strconv.Itoa(secs))
}

func (m *APIKeyMiddleware) logUsage(key *models.APIKey, c echo.Context, start time.Time, handlerErr error) {
	status := c.Response().Status
	if handlerErr != nil {
		if he, ok := handlerErr.(*echo.HTTPError); ok {
			status = he.Code
		}
	}
	ip := c.RealIP()
	ua := c.Request().UserAgent()
	var errMsg *string
	if handlerErr != nil {
		s := handlerErr.Error()
		errMsg = &s
	}
	apiKeyID := key.ID
	params := repositories.CreateUsageLogParams{
		WorkspaceID:  key.WorkspaceID,
		APIKeyID:     &apiKeyID,
		Method:       c.Request().Method,
		Path:         c.Request().URL.Path,
		StatusCode:   status,
		LatencyMs:    int(time.Since(start).Milliseconds()),
		IP:           strOrNil(ip),
		UserAgent:    strOrNil(ua),
		ErrorMessage: errMsg,
	}
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		_ = m.keys.CreateUsageLog(bg, params)
	}()
}

func (m *APIKeyMiddleware) unauthorized(c echo.Context, msg string) error {
	c.Response().Header().Set("WWW-Authenticate", "Bearer")
	return utils.Error(c, http.StatusUnauthorized, "unauthorized", msg)
}

// APIKeyID returns the authenticating API key's id from the context.
func APIKeyID(c echo.Context) string {
	v, _ := c.Get(ContextKeyAPIKeyID).(string)
	return v
}

func strOrNil(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

package middleware

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"

	"github.com/aichat/api/internal/apikey"
	"github.com/aichat/api/internal/models"
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
	keys             *repositories.APIKeyRepository
	rdb              *redis.Client
	ratePerMinute    int
}

// NewAPIKeyMiddleware constructs an APIKeyMiddleware. A ratePerMinute <= 0
// disables rate limiting.
func NewAPIKeyMiddleware(keys *repositories.APIKeyRepository, rdb *redis.Client, ratePerMinute int) *APIKeyMiddleware {
	return &APIKeyMiddleware{keys: keys, rdb: rdb, ratePerMinute: ratePerMinute}
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
			if allowed, retryAfter := m.allow(ctx, key.ID); !allowed {
				c.Response().Header().Set("Retry-After", fmt.Sprintf("%d", retryAfter))
				return utils.Error(c, http.StatusTooManyRequests,
					"rate_limited", "Batas rate limit API terlampaui, coba lagi nanti")
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

// allow implements a fixed-window counter in Redis. Returns (allowed,
// secondsUntilReset). If Redis is unavailable it fails open (allows) so a
// cache outage never takes the public API down.
func (m *APIKeyMiddleware) allow(ctx context.Context, keyID string) (bool, int) {
	if m.ratePerMinute <= 0 || m.rdb == nil {
		return true, 0
	}
	window := time.Now().Unix() / 60
	redisKey := fmt.Sprintf("apirl:%s:%d", keyID, window)

	count, err := m.rdb.Incr(ctx, redisKey).Result()
	if err != nil {
		return true, 0 // fail open
	}
	if count == 1 {
		_ = m.rdb.Expire(ctx, redisKey, 70*time.Second).Err()
	}
	if count > int64(m.ratePerMinute) {
		return false, 60 - int(time.Now().Unix()%60)
	}
	return true, 0
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

package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"

	"github.com/aichat/api/internal/redis"
)

// HealthHandler reports service liveness/readiness.
type HealthHandler struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

// NewHealthHandler constructs a HealthHandler.
func NewHealthHandler(db *pgxpool.Pool, rdb *redis.Client) *HealthHandler {
	return &HealthHandler{db: db, redis: rdb}
}

// Health handles GET /health — a readiness probe that pings dependencies.
func (h *HealthHandler) Health(c echo.Context) error {
	ctx, cancel := context.WithTimeout(c.Request().Context(), 2*time.Second)
	defer cancel()

	checks := map[string]string{
		"postgres": "ok",
		"redis":    "ok",
	}
	status := http.StatusOK

	if err := h.db.Ping(ctx); err != nil {
		checks["postgres"] = "down"
		status = http.StatusServiceUnavailable
	}
	if err := h.redis.Ping(ctx).Err(); err != nil {
		checks["redis"] = "down"
		status = http.StatusServiceUnavailable
	}

	return c.JSON(status, map[string]interface{}{
		"status":  map[bool]string{true: "healthy", false: "degraded"}[status == http.StatusOK],
		"service": "aichat-api",
		"time":    time.Now().UTC(),
		"checks":  checks,
	})
}

package config

import (
	"errors"
	"fmt"
	"log"
	"net"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/joho/godotenv"
)

// Config holds all runtime configuration, sourced from environment
// variables (and a local .env file during development).
type Config struct {
	AppEnv  string
	Port    string
	BaseURL string

	DatabaseURL string
	RedisURL    string

	JWTSecret     string
	JWTAccessTTL  time.Duration
	JWTRefreshTTL time.Duration

	// Secret used to derive the AES-256 key for encrypting channel
	// credentials at rest.
	ChannelEncryptionKey string

	// InboxDemoEcho, when true, fabricates an inbound reply 1.5s after
	// every outbound message so the realtime path is observable without
	// real provider integration. Disable in production.
	InboxDemoEcho bool

	// WhatsApp Cloud API configuration.
	WhatsAppAPIBaseURL  string
	WhatsAppVerifyToken string
	WhatsAppAppSecret   string

	// Instagram + Messenger (Meta Messenger Platform) configuration.
	// MetaAppSecret is shared between IG + Messenger because both
	// subscriptions live under the same Meta App.
	MetaAPIBaseURL       string
	InstagramVerifyToken string
	MessengerVerifyToken string
	MetaAppSecret        string

	// BroadcastQueueKey is the Redis list name shared with the worker.
	BroadcastQueueKey string

	// AI provider (mock | openai). The API key is read server-side only
	// and is never exposed to the frontend.
	AIProvider       string
	AIAPIKey         string
	AIBaseURL        string
	AIChatModel      string
	AIEmbeddingModel string
	AIChunkSize      int

	// Developer API (Part 10). Rate limit is per API key, per minute,
	// enforced in Redis. Webhook workers + queue size control the
	// outbound delivery pipeline.
	APIRateLimitPerMinute int
	WebhookWorkers        int
	WebhookQueueSize      int

	// WebhookAllowPrivateTargets lets outbound webhooks reach loopback /
	// private-network hosts (e.g. a local n8n). Defaults to true only in
	// development; production blocks them to prevent SSRF.
	WebhookAllowPrivateTargets bool

	// Brute-force protection for /auth endpoints (Redis-backed).
	// AuthIPRatePerMinute caps login+register requests per client IP;
	// LoginMaxFailures caps failed logins per email within
	// LoginFailureWindow. Zero disables the respective limit.
	AuthIPRatePerMinute int
	LoginMaxFailures    int
	LoginFailureWindow  time.Duration

	// MaxBodySize caps request bodies (Echo BodyLimit syntax, e.g. "10M").
	MaxBodySize string

	// TrustedProxies lists extra CIDRs (beyond loopback/private ranges)
	// whose X-Forwarded-For is trusted, e.g. a CDN in front of the API.
	TrustedProxies []*net.IPNet

	// Midtrans payment gateway (Part 11). Placeholder by default — leave
	// the server key empty to run the dummy billing flow with no real
	// charges.
	MidtransServerKey string
	MidtransBaseURL   string

	CORSOrigins []string

	UploadDir string
}

// Load reads configuration from the environment. It is safe to call once
// at startup. Missing values fall back to sensible development defaults.
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, using environment variables")
	}

	appEnv := getEnv("APP_ENV", "development")
	isProd := strings.EqualFold(appEnv, "production")

	cfg := &Config{
		AppEnv:        appEnv,
		Port:          getEnv("PORT", "8080"),
		BaseURL:       getEnv("BASE_URL", "http://localhost:8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable"),
		RedisURL:      getEnv("REDIS_URL", "redis://localhost:6379/0"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-me-in-production"),
		JWTAccessTTL:  getDuration("JWT_ACCESS_TTL", 15*time.Minute),
		JWTRefreshTTL: getDuration("JWT_REFRESH_TTL", 7*24*time.Hour),
		ChannelEncryptionKey: getEnv("CHANNEL_ENCRYPTION_KEY",
			"dev-channel-encryption-key-change-me"),
		InboxDemoEcho:              getBool("INBOX_DEMO_ECHO", !isProd),
		WhatsAppAPIBaseURL:         getEnv("WHATSAPP_API_BASE_URL", "https://graph.facebook.com/v20.0"),
		WhatsAppVerifyToken:        getEnv("WHATSAPP_VERIFY_TOKEN", "dev-whatsapp-verify-token"),
		WhatsAppAppSecret:          getEnv("WHATSAPP_APP_SECRET", ""),
		MetaAPIBaseURL:             getEnv("META_API_BASE_URL", "https://graph.facebook.com/v20.0"),
		InstagramVerifyToken:       getEnv("INSTAGRAM_VERIFY_TOKEN", "dev-instagram-verify-token"),
		MessengerVerifyToken:       getEnv("MESSENGER_VERIFY_TOKEN", "dev-messenger-verify-token"),
		MetaAppSecret:              getEnv("META_APP_SECRET", ""),
		BroadcastQueueKey:          getEnv("BROADCAST_QUEUE_KEY", "aichat:broadcast:queue"),
		AIProvider:                 strings.ToLower(getEnv("AI_PROVIDER", "mock")),
		AIAPIKey:                   getEnv("AI_API_KEY", ""),
		AIBaseURL:                  getEnv("AI_BASE_URL", "https://api.openai.com/v1"),
		AIChatModel:                getEnv("AI_MODEL", "gpt-4o-mini"),
		AIEmbeddingModel:           getEnv("AI_EMBED_MODEL", "text-embedding-3-small"),
		AIChunkSize:                getInt("AI_CHUNK_SIZE", 800),
		APIRateLimitPerMinute:      getInt("API_RATE_LIMIT_PER_MINUTE", 120),
		WebhookWorkers:             getInt("WEBHOOK_WORKERS", 4),
		WebhookQueueSize:           getInt("WEBHOOK_QUEUE_SIZE", 256),
		WebhookAllowPrivateTargets: getBool("WEBHOOK_ALLOW_PRIVATE_TARGETS", !isProd),
		AuthIPRatePerMinute:        getInt("AUTH_IP_RATE_PER_MINUTE", 30),
		LoginMaxFailures:           getInt("LOGIN_MAX_FAILURES", 10),
		LoginFailureWindow:         getDuration("LOGIN_FAILURE_WINDOW", 15*time.Minute),
		MaxBodySize:                getEnv("MAX_BODY_SIZE", "10M"),
		TrustedProxies:             getCIDRs("TRUSTED_PROXIES"),
		MidtransServerKey:          getEnv("MIDTRANS_SERVER_KEY", ""),
		MidtransBaseURL:            getEnv("MIDTRANS_BASE_URL", ""),
		CORSOrigins:                splitAndTrim(getEnv("CORS_ORIGINS", "http://localhost:3000")),
		UploadDir:                  getEnv("UPLOAD_DIR", "./storage/uploads"),
	}

	return cfg
}

// Development-only defaults that must never reach production.
const (
	defaultJWTSecret     = "dev-secret-change-me-in-production"
	defaultEncryptionKey = "dev-channel-encryption-key-change-me"
	minSecretLength      = 32
)

// Validate reports configuration that is unsafe to run with. In
// development it only returns errors for values that would break the
// server outright; in production it also rejects placeholder secrets and
// disabled webhook signature checks, so a misconfigured deploy fails at
// boot instead of running insecurely.
func (c *Config) Validate() error {
	var errs []error
	if c.JWTSecret == "" {
		errs = append(errs, errors.New("JWT_SECRET must not be empty"))
	}
	if c.ChannelEncryptionKey == "" {
		errs = append(errs, errors.New("CHANNEL_ENCRYPTION_KEY must not be empty"))
	}

	if c.IsProduction() {
		if c.JWTSecret == defaultJWTSecret || len(c.JWTSecret) < minSecretLength {
			errs = append(errs, fmt.Errorf(
				"JWT_SECRET must be a random value of at least %d characters in production", minSecretLength))
		}
		if c.ChannelEncryptionKey == defaultEncryptionKey || len(c.ChannelEncryptionKey) < minSecretLength {
			errs = append(errs, fmt.Errorf(
				"CHANNEL_ENCRYPTION_KEY must be a random value of at least %d characters in production", minSecretLength))
		}
		// An empty app secret disables X-Hub-Signature-256 verification,
		// letting anyone forge inbound customer messages.
		if c.WhatsAppAppSecret == "" {
			errs = append(errs, errors.New("WHATSAPP_APP_SECRET is required in production (webhook signature verification)"))
		}
		if c.MetaAppSecret == "" {
			errs = append(errs, errors.New("META_APP_SECRET is required in production (webhook signature verification)"))
		}
		if c.InboxDemoEcho {
			errs = append(errs, errors.New("INBOX_DEMO_ECHO must be false in production"))
		}
	}
	return errors.Join(errs...)
}

// IsProduction reports whether the API runs in production mode.
func (c *Config) IsProduction() bool {
	return strings.EqualFold(c.AppEnv, "production")
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		log.Printf("config: invalid duration for %s=%q, using default", key, v)
		return fallback
	}
	return d
}

func getInt(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		log.Printf("config: invalid int for %s=%q, using default", key, v)
		return fallback
	}
	return n
}

func getBool(key string, fallback bool) bool {
	v := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	switch v {
	case "":
		return fallback
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func splitAndTrim(v string) []string {
	parts := strings.Split(v, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}

// getCIDRs parses a comma-separated list of CIDRs (bare IPs are treated as
// single-host ranges). Invalid entries are logged and skipped.
func getCIDRs(key string) []*net.IPNet {
	var out []*net.IPNet
	for _, v := range splitAndTrim(os.Getenv(key)) {
		if !strings.Contains(v, "/") {
			if ip := net.ParseIP(v); ip != nil && ip.To4() != nil {
				v += "/32"
			} else {
				v += "/128"
			}
		}
		_, ipnet, err := net.ParseCIDR(v)
		if err != nil {
			log.Printf("config: invalid CIDR in %s: %q", key, v)
			continue
		}
		out = append(out, ipnet)
	}
	return out
}

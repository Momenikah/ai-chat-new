// Package config loads worker runtime configuration from the environment.
package config

import (
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/joho/godotenv"
)

// Config holds worker runtime configuration.
type Config struct {
	AppEnv             string
	RedisURL           string
	DatabaseURL        string
	QueueKey           string
	BroadcastQueueKey  string
	Concurrency        int
	MaxAttempts        int
	WhatsAppAPIBaseURL string
	MetaAPIBaseURL     string
}

// Load reads configuration from environment / .env.
func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("config: no .env file found, using environment variables")
	}

	return &Config{
		AppEnv:             getEnv("APP_ENV", "development"),
		RedisURL:           getEnv("REDIS_URL", "redis://localhost:6379/0"),
		DatabaseURL:        getEnv("DATABASE_URL", "postgres://aichat:aichat@localhost:5432/aichat?sslmode=disable"),
		QueueKey:           getEnv("WORKER_QUEUE_KEY", "aichat:jobs:default"),
		BroadcastQueueKey:  getEnv("BROADCAST_QUEUE_KEY", "aichat:broadcast:queue"),
		Concurrency:        getInt("WORKER_CONCURRENCY", 4),
		MaxAttempts:        getInt("WORKER_MAX_ATTEMPTS", 3),
		WhatsAppAPIBaseURL: getEnv("WHATSAPP_API_BASE_URL", "https://graph.facebook.com/v20.0"),
		MetaAPIBaseURL:     getEnv("META_API_BASE_URL", "https://graph.facebook.com/v20.0"),
	}
}

func getEnv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func getInt(key string, fallback int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return fallback
}

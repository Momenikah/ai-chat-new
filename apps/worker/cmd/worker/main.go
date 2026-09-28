// Command worker consumes the broadcast job queue from Redis and dispatches
// messages through Meta's APIs (WhatsApp Cloud, Instagram, Messenger). On
// success it persists the provider message id and bumps campaign counters;
// on failure it retries with exponential backoff before marking the
// recipient `failed`.
package main

import (
	"context"
	"fmt"
	"log"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/aichat/worker/internal/broadcast"
	"github.com/aichat/worker/internal/config"
	"github.com/aichat/worker/internal/webhookemit"
)

func main() {
	cfg := config.Load()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	rdb, err := newRedis(ctx, cfg.RedisURL)
	if err != nil {
		log.Fatalf("worker: redis: %v", err)
	}
	defer rdb.Close()
	log.Println("worker: connected to Redis")

	pool, err := newPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("worker: postgres: %v", err)
	}
	defer pool.Close()
	log.Println("worker: connected to Postgres")

	sender := broadcast.NewSender(cfg.WhatsAppAPIBaseURL, cfg.MetaAPIBaseURL)
	store := broadcast.NewStore(pool)
	limiter := broadcast.NewChannelLimiter()
	webhookEmitter := webhookemit.New(pool, cfg.WebhookAllowPrivateTargets)
	proc := broadcast.NewProcessor(rdb, cfg.BroadcastQueueKey, sender, store, limiter, cfg.MaxAttempts, webhookEmitter)

	log.Printf("worker: starting %d goroutines on queue %q (env=%s)",
		cfg.Concurrency, cfg.BroadcastQueueKey, cfg.AppEnv)

	var wg sync.WaitGroup
	for i := 0; i < cfg.Concurrency; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			proc.Run(ctx, id+1)
		}(i)
	}

	<-ctx.Done()
	log.Println("worker: shutdown signal received, draining…")
	wg.Wait()
	log.Println("worker: stopped")
}

// newRedis connects + pings Redis.
func newRedis(ctx context.Context, url string) (*redis.Client, error) {
	opt, err := redis.ParseURL(url)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	c := redis.NewClient(opt)
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := c.Ping(pingCtx).Err(); err != nil {
		_ = c.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}
	return c, nil
}

// newPool builds a small pgxpool the worker uses for status updates.
func newPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse dsn: %w", err)
	}
	cfg.MaxConns = 6
	cfg.MinConns = 1
	cfg.MaxConnLifetime = time.Hour
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping: %w", err)
	}
	return pool, nil
}

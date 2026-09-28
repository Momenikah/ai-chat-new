// Package ratelimit implements fixed-window request counters backed by
// Redis (shared across API replicas) or memory (tests, single node).
//
// Limiters fail open: if the backing store is unavailable the request is
// allowed, so a cache outage degrades protection instead of taking the
// API down.
package ratelimit

import (
	"context"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

// Store is a counter keyed by string whose value expires after the window
// that started with its first increment.
type Store interface {
	// Incr increments key, starting a new window of length `window` if
	// the key did not exist, and returns the new count plus the time left
	// in the current window.
	Incr(ctx context.Context, key string, window time.Duration) (int64, time.Duration, error)
	// Get returns the current count and remaining window (0, 0 if unset).
	Get(ctx context.Context, key string) (int64, time.Duration, error)
	// Reset deletes key.
	Reset(ctx context.Context, key string) error
}

// Limiter caps events per key within a fixed window.
type Limiter struct {
	store  Store
	prefix string
	limit  int
	window time.Duration
}

// New constructs a Limiter. A nil store or limit <= 0 disables it (every
// call is allowed).
func New(store Store, prefix string, limit int, window time.Duration) *Limiter {
	return &Limiter{store: store, prefix: prefix, limit: limit, window: window}
}

func (l *Limiter) enabled() bool {
	return l != nil && l.store != nil && l.limit > 0 && l.window > 0
}

func (l *Limiter) key(k string) string { return l.prefix + ":" + k }

// Allow records one event for key and reports whether it is within the
// limit. When it is not, retryAfter is the time until the window resets.
func (l *Limiter) Allow(ctx context.Context, key string) (allowed bool, retryAfter time.Duration) {
	if !l.enabled() {
		return true, 0
	}
	count, ttl, err := l.store.Incr(ctx, l.key(key), l.window)
	if err != nil {
		return true, 0
	}
	if count > int64(l.limit) {
		return false, retryDuration(ttl, l.window)
	}
	return true, 0
}

// Blocked reports, without recording an event, whether key has already
// reached the limit in the current window.
func (l *Limiter) Blocked(ctx context.Context, key string) (blocked bool, retryAfter time.Duration) {
	if !l.enabled() {
		return false, 0
	}
	count, ttl, err := l.store.Get(ctx, l.key(key))
	if err != nil {
		return false, 0
	}
	if count >= int64(l.limit) {
		return true, retryDuration(ttl, l.window)
	}
	return false, 0
}

// Hit records one event for key without checking the limit.
func (l *Limiter) Hit(ctx context.Context, key string) {
	if l.enabled() {
		_, _, _ = l.store.Incr(ctx, l.key(key), l.window)
	}
}

// Reset clears the counter for key.
func (l *Limiter) Reset(ctx context.Context, key string) {
	if l.enabled() {
		_ = l.store.Reset(ctx, l.key(key))
	}
}

func retryDuration(ttl, window time.Duration) time.Duration {
	if ttl <= 0 {
		return window
	}
	return ttl
}

/* ------------------------------ Redis store ----------------------------- */

// RedisStore implements Store on Redis.
type RedisStore struct {
	rdb *redis.Client
}

// NewRedisStore wraps a Redis client. It returns nil for a nil client so
// callers can pass the result straight to New (which then disables the
// limiter).
func NewRedisStore(rdb *redis.Client) Store {
	if rdb == nil {
		return nil
	}
	return &RedisStore{rdb: rdb}
}

// Incr implements Store.
func (s *RedisStore) Incr(ctx context.Context, key string, window time.Duration) (int64, time.Duration, error) {
	pipe := s.rdb.TxPipeline()
	incr := pipe.Incr(ctx, key)
	pttl := pipe.PTTL(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil {
		return 0, 0, err
	}
	ttl := pttl.Val()
	// PTTL is negative when the key has no expiry yet (first hit, or a
	// previous Expire failed) — start the window now.
	if ttl < 0 {
		if err := s.rdb.PExpire(ctx, key, window).Err(); err != nil {
			return 0, 0, err
		}
		ttl = window
	}
	return incr.Val(), ttl, nil
}

// Get implements Store.
func (s *RedisStore) Get(ctx context.Context, key string) (int64, time.Duration, error) {
	pipe := s.rdb.Pipeline()
	get := pipe.Get(ctx, key)
	pttl := pipe.PTTL(ctx, key)
	if _, err := pipe.Exec(ctx); err != nil && err != redis.Nil {
		return 0, 0, err
	}
	n, err := get.Int64()
	if err == redis.Nil {
		return 0, 0, nil
	}
	if err != nil {
		return 0, 0, err
	}
	return n, pttl.Val(), nil
}

// Reset implements Store.
func (s *RedisStore) Reset(ctx context.Context, key string) error {
	return s.rdb.Del(ctx, key).Err()
}

/* ------------------------------ Memory store ---------------------------- */

// MemoryStore implements Store in process memory. Suitable for tests and
// single-instance deployments; counters are not shared across replicas.
type MemoryStore struct {
	mu      sync.Mutex
	entries map[string]memEntry
	now     func() time.Time
}

type memEntry struct {
	count     int64
	expiresAt time.Time
}

// NewMemoryStore constructs an empty MemoryStore.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{entries: map[string]memEntry{}, now: time.Now}
}

// Incr implements Store.
func (s *MemoryStore) Incr(_ context.Context, key string, window time.Duration) (int64, time.Duration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	e, ok := s.entries[key]
	if !ok || !now.Before(e.expiresAt) {
		e = memEntry{expiresAt: now.Add(window)}
	}
	e.count++
	s.entries[key] = e
	return e.count, e.expiresAt.Sub(now), nil
}

// Get implements Store.
func (s *MemoryStore) Get(_ context.Context, key string) (int64, time.Duration, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := s.now()
	e, ok := s.entries[key]
	if !ok || !now.Before(e.expiresAt) {
		return 0, 0, nil
	}
	return e.count, e.expiresAt.Sub(now), nil
}

// Reset implements Store.
func (s *MemoryStore) Reset(_ context.Context, key string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.entries, key)
	return nil
}

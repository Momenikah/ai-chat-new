package ratelimit

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
)

// Runs only when TEST_REDIS_URL is set (e.g. redis://localhost:6379/15).
func TestRedisStore(t *testing.T) {
	url := os.Getenv("TEST_REDIS_URL")
	if url == "" {
		t.Skip("TEST_REDIS_URL not set")
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		t.Fatal(err)
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()
	ctx := context.Background()

	l := New(NewRedisStore(rdb), "test-"+uuid.NewString(), 2, 2*time.Second)
	for i := 0; i < 2; i++ {
		if ok, _ := l.Allow(ctx, "k"); !ok {
			t.Fatalf("request %d rejected", i+1)
		}
	}
	ok, retry := l.Allow(ctx, "k")
	if ok || retry <= 0 || retry > 2*time.Second {
		t.Fatalf("3rd request: allowed=%v retry=%v, want rejected with retry in (0,2s]", ok, retry)
	}
	if blocked, _ := l.Blocked(ctx, "k"); !blocked {
		t.Fatal("Blocked = false after exceeding limit")
	}
	if blocked, _ := l.Blocked(ctx, "unused"); blocked {
		t.Fatal("unset key reported blocked")
	}

	l.Reset(ctx, "k")
	if ok, _ := l.Allow(ctx, "k"); !ok {
		t.Fatal("request after Reset rejected")
	}

	// Window expiry.
	l.Hit(ctx, "k")
	time.Sleep(2100 * time.Millisecond)
	if blocked, _ := l.Blocked(ctx, "k"); blocked {
		t.Fatal("still blocked after window expired")
	}
}

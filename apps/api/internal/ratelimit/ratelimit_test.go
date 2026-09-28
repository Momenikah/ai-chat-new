package ratelimit

import (
	"context"
	"errors"
	"testing"
	"time"
)

func newClockedStore() (*MemoryStore, *time.Time) {
	now := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	s := NewMemoryStore()
	s.now = func() time.Time { return now }
	return s, &now
}

func TestAllowEnforcesLimitAndResetsAfterWindow(t *testing.T) {
	ctx := context.Background()
	store, now := newClockedStore()
	l := New(store, "test", 3, time.Minute)

	for i := 1; i <= 3; i++ {
		if ok, _ := l.Allow(ctx, "k"); !ok {
			t.Fatalf("request %d rejected, want allowed", i)
		}
	}
	ok, retry := l.Allow(ctx, "k")
	if ok {
		t.Fatal("4th request allowed, want rejected")
	}
	if retry <= 0 || retry > time.Minute {
		t.Fatalf("retryAfter = %v, want within (0, 1m]", retry)
	}

	// Keys are independent.
	if ok, _ := l.Allow(ctx, "other"); !ok {
		t.Fatal("independent key rejected")
	}

	*now = now.Add(time.Minute)
	if ok, _ := l.Allow(ctx, "k"); !ok {
		t.Fatal("request after window rejected")
	}
}

func TestBlockedHitReset(t *testing.T) {
	ctx := context.Background()
	store, _ := newClockedStore()
	l := New(store, "fail", 2, 15*time.Minute)

	if blocked, _ := l.Blocked(ctx, "a@b.c"); blocked {
		t.Fatal("fresh key blocked")
	}
	l.Hit(ctx, "a@b.c")
	if blocked, _ := l.Blocked(ctx, "a@b.c"); blocked {
		t.Fatal("blocked after 1 of 2 hits")
	}
	l.Hit(ctx, "a@b.c")
	blocked, retry := l.Blocked(ctx, "a@b.c")
	if !blocked || retry != 15*time.Minute {
		t.Fatalf("Blocked = %v, %v; want true, 15m", blocked, retry)
	}
	l.Reset(ctx, "a@b.c")
	if blocked, _ := l.Blocked(ctx, "a@b.c"); blocked {
		t.Fatal("blocked after reset")
	}
}

func TestDisabledLimiterAllowsEverything(t *testing.T) {
	ctx := context.Background()
	for _, l := range []*Limiter{
		nil,
		New(nil, "x", 1, time.Minute),
		New(NewMemoryStore(), "x", 0, time.Minute),
	} {
		for i := 0; i < 5; i++ {
			if ok, _ := l.Allow(ctx, "k"); !ok {
				t.Fatal("disabled limiter rejected a request")
			}
		}
		if blocked, _ := l.Blocked(ctx, "k"); blocked {
			t.Fatal("disabled limiter reports blocked")
		}
	}
}

type failingStore struct{}

func (failingStore) Incr(context.Context, string, time.Duration) (int64, time.Duration, error) {
	return 0, 0, errors.New("down")
}
func (failingStore) Get(context.Context, string) (int64, time.Duration, error) {
	return 0, 0, errors.New("down")
}
func (failingStore) Reset(context.Context, string) error { return errors.New("down") }

func TestStoreErrorsFailOpen(t *testing.T) {
	l := New(failingStore{}, "x", 1, time.Minute)
	for i := 0; i < 3; i++ {
		if ok, _ := l.Allow(context.Background(), "k"); !ok {
			t.Fatal("store outage rejected request, want fail-open")
		}
	}
	if blocked, _ := l.Blocked(context.Background(), "k"); blocked {
		t.Fatal("store outage reports blocked, want fail-open")
	}
}

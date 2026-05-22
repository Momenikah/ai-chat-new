package broadcast

import (
	"context"
	"sync"
	"time"
)

// ChannelLimiter is a per-channel cooperative rate limiter.
//
// `Wait` blocks until this goroutine is allowed to send the next message
// for the given channel based on the campaign-level `messages-per-minute`
// budget. Concurrent goroutines serialize via the internal mutex; the
// next-allowed timestamp advances by one interval on each call.
type ChannelLimiter struct {
	mu     sync.Mutex
	nextAt map[string]time.Time
}

// NewChannelLimiter constructs a ChannelLimiter.
func NewChannelLimiter() *ChannelLimiter {
	return &ChannelLimiter{nextAt: map[string]time.Time{}}
}

// Wait sleeps until the next slot opens for channelID. ratePerMinute <= 0
// is treated as 60.
func (l *ChannelLimiter) Wait(ctx context.Context, channelID string, ratePerMinute int) error {
	if ratePerMinute <= 0 {
		ratePerMinute = 60
	}
	interval := time.Minute / time.Duration(ratePerMinute)

	l.mu.Lock()
	now := time.Now()
	next, ok := l.nextAt[channelID]
	if !ok || next.Before(now) {
		next = now
	}
	wait := next.Sub(now)
	l.nextAt[channelID] = next.Add(interval)
	l.mu.Unlock()

	if wait <= 0 {
		return nil
	}
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(wait):
		return nil
	}
}

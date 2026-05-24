// Package queue is a thin Redis-list-backed job queue. The API enqueues
// jobs with Enqueue; the worker consumes them with Dequeue (blocking).
package queue

import (
	"context"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/aichat/worker/internal/jobs"
)

// Queue wraps a Redis list used as a FIFO job queue.
type Queue struct {
	rdb *redis.Client
	key string
}

// New connects to Redis and returns a Queue bound to the given list key.
func New(ctx context.Context, redisURL, key string) (*Queue, error) {
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		return nil, fmt.Errorf("parse redis url: %w", err)
	}
	rdb := redis.NewClient(opt)

	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := rdb.Ping(pingCtx).Err(); err != nil {
		_ = rdb.Close()
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	return &Queue{rdb: rdb, key: key}, nil
}

// Close releases the Redis connection.
func (q *Queue) Close() error { return q.rdb.Close() }

// Enqueue pushes a job onto the tail of the queue (LPUSH).
func (q *Queue) Enqueue(ctx context.Context, job jobs.Job) error {
	raw, err := job.Marshal()
	if err != nil {
		return err
	}
	return q.rdb.LPush(ctx, q.key, raw).Err()
}

// Dequeue blocks until a job is available or the context is cancelled.
// It returns (nil, nil) when the blocking poll simply times out, so the
// caller can re-check its context and loop.
func (q *Queue) Dequeue(ctx context.Context, timeout time.Duration) (*jobs.Job, error) {
	res, err := q.rdb.BRPop(ctx, timeout, q.key).Result()
	if err == redis.Nil {
		return nil, nil // poll timed out, no job
	}
	if err != nil {
		return nil, err
	}
	// res = [key, value]
	job, err := jobs.Unmarshal([]byte(res[1]))
	if err != nil {
		return nil, fmt.Errorf("unmarshal job: %w", err)
	}
	return &job, nil
}

// Requeue pushes a failed job back for another attempt.
func (q *Queue) Requeue(ctx context.Context, job jobs.Job) error {
	job.Attempts++
	return q.Enqueue(ctx, job)
}

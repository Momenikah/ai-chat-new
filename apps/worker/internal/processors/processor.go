// Package processors dispatches dequeued jobs to their handlers.
//
// Part 1 ships stub handlers that log the work. Real channel delivery
// (WhatsApp/Instagram/Messenger), broadcast fan-out and webhook posting
// are implemented in later parts.
package processors

import (
	"context"
	"fmt"
	"log"

	"github.com/aichat/worker/internal/jobs"
)

// Handler processes a single job of a known type.
type Handler func(ctx context.Context, job jobs.Job) error

// Processor routes jobs to handlers by type.
type Processor struct {
	handlers map[jobs.Type]Handler
}

// New builds a Processor with the default (stub) handlers registered.
func New() *Processor {
	p := &Processor{handlers: make(map[jobs.Type]Handler)}
	p.Register(jobs.TypeSendMessage, handleSendMessage)
	p.Register(jobs.TypeBroadcast, handleBroadcast)
	p.Register(jobs.TypeWebhookDelivery, handleWebhookDelivery)
	return p
}

// Register binds a handler to a job type.
func (p *Processor) Register(t jobs.Type, h Handler) {
	p.handlers[t] = h
}

// Process dispatches a job to its handler.
func (p *Processor) Process(ctx context.Context, job jobs.Job) error {
	handler, ok := p.handlers[job.Type]
	if !ok {
		return fmt.Errorf("no handler registered for job type %q", job.Type)
	}
	return handler(ctx, job)
}

// --- Stub handlers ----------------------------------------------------------

func handleSendMessage(_ context.Context, job jobs.Job) error {
	log.Printf("processor: [send_message] job=%s payload=%s", job.ID, job.Payload)
	return nil
}

func handleBroadcast(_ context.Context, job jobs.Job) error {
	log.Printf("processor: [broadcast] job=%s payload=%s", job.ID, job.Payload)
	return nil
}

func handleWebhookDelivery(_ context.Context, job jobs.Job) error {
	log.Printf("processor: [webhook_delivery] job=%s payload=%s", job.ID, job.Payload)
	return nil
}

// Package ai contains the AI-chatbot primitives: an LLM provider
// abstraction, an embedding helper, a text chunker, and a (currently
// in-memory) vector store backed by Postgres real[] arrays.
//
// Swap providers via env: `AI_PROVIDER=openai|mock`.
package ai

import (
	"context"
	"errors"
)

// ChatMessage is one turn in an LLM chat completion call.
type ChatMessage struct {
	Role    string `json:"role"` // "system" | "user" | "assistant"
	Content string `json:"content"`
}

// ChatOptions controls a chat call.
type ChatOptions struct {
	Model       string
	Temperature float32
	MaxTokens   int
}

// ChatResult is what the LLM returns to the caller.
type ChatResult struct {
	Text       string  `json:"text"`
	Confidence float32 `json:"confidence"` // 0..1, provider-best-effort
	Model      string  `json:"model"`
}

// LLM is the provider-agnostic interface used by the rest of the
// codebase. Both real and mock providers implement it.
type LLM interface {
	// Chat completes a conversation and returns the assistant message.
	Chat(ctx context.Context, msgs []ChatMessage, opts ChatOptions) (*ChatResult, error)

	// Embed returns a vector representation of the input text.
	Embed(ctx context.Context, model, text string) ([]float32, error)

	// Name returns a stable identifier for logging.
	Name() string
}

// ErrNotConfigured signals that the provider lacks credentials and the
// caller should fall back to the mock.
var ErrNotConfigured = errors.New("ai: provider not configured")

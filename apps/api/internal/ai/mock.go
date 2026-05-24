package ai

import (
	"context"
	"crypto/sha256"
	"encoding/binary"
	"strings"
)

// MockProvider is a deterministic, no-network LLM implementation used in
// development and tests. Embeddings are derived from a SHA-256 expansion
// of the input so retrieval still works without a real model.
type MockProvider struct {
	dim int
}

// NewMockProvider constructs a MockProvider with the given embedding
// dimension. 64 is a good demo default.
func NewMockProvider(dim int) *MockProvider {
	if dim <= 0 {
		dim = 64
	}
	return &MockProvider{dim: dim}
}

// Name implements LLM.
func (m *MockProvider) Name() string { return "mock" }

// Chat produces a deterministic, polite reply that incorporates the last
// user message + the first retrieved knowledge chunk if present (passed
// via a system message with prefix "KNOWLEDGE:").
func (m *MockProvider) Chat(_ context.Context, msgs []ChatMessage, _ ChatOptions) (*ChatResult, error) {
	var userMsg, knowledge string
	for _, msg := range msgs {
		switch msg.Role {
		case "user":
			userMsg = msg.Content
		case "system":
			if idx := strings.Index(msg.Content, "KNOWLEDGE:"); idx >= 0 {
				knowledge = strings.TrimSpace(msg.Content[idx+len("KNOWLEDGE:"):])
			}
		}
	}

	reply := "Halo, terima kasih sudah menghubungi kami."
	confidence := float32(0.45) // low — encourages handoff by default
	if knowledge != "" {
		excerpt := knowledge
		if len(excerpt) > 200 {
			excerpt = excerpt[:200] + "…"
		}
		reply = "Berdasarkan informasi kami: " + excerpt
		confidence = 0.78
	} else if userMsg != "" {
		reply += " Anda menanyakan: \"" + strings.TrimSpace(userMsg) + "\". Tim kami akan menjawab segera."
	}

	return &ChatResult{Text: reply, Confidence: confidence, Model: "mock"}, nil
}

// Embed produces a deterministic dense vector from the SHA-256 expansion
// of the input. Same input → same vector → meaningful cosine similarity
// between similar inputs (since they share a prefix in many cases).
func (m *MockProvider) Embed(_ context.Context, _ string, text string) ([]float32, error) {
	// Mix the lowercased text so casing doesn't perturb retrieval.
	normalized := strings.ToLower(strings.TrimSpace(text))

	out := make([]float32, m.dim)
	// Roll multiple SHA-256 blocks to fill the requested dimension.
	seed := sha256.Sum256([]byte(normalized))
	cursor := 0
	for cursor < m.dim {
		for i := 0; i+4 <= len(seed) && cursor < m.dim; i += 4 {
			bits := binary.BigEndian.Uint32(seed[i : i+4])
			// Map uint32 -> [-1, 1].
			out[cursor] = (float32(bits)/4294967295.0)*2 - 1
			cursor++
		}
		next := sha256.Sum256(seed[:])
		seed = next
	}
	return out, nil
}

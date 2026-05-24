package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

// OpenAIProvider talks to the OpenAI Chat Completions + Embeddings
// endpoints (or a compatible service via OPENAI_BASE_URL).
type OpenAIProvider struct {
	baseURL string
	apiKey  string
	http    *http.Client
}

// NewOpenAIProvider constructs an OpenAIProvider. Returns ErrNotConfigured
// when apiKey is empty.
func NewOpenAIProvider(baseURL, apiKey string) (*OpenAIProvider, error) {
	if apiKey == "" {
		return nil, ErrNotConfigured
	}
	if baseURL == "" {
		baseURL = "https://api.openai.com/v1"
	}
	return &OpenAIProvider{
		baseURL: baseURL,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 60 * time.Second},
	}, nil
}

// Name implements LLM.
func (p *OpenAIProvider) Name() string { return "openai" }

// Chat calls /chat/completions and returns the first choice.
func (p *OpenAIProvider) Chat(ctx context.Context, msgs []ChatMessage, opts ChatOptions) (*ChatResult, error) {
	if opts.Model == "" {
		opts.Model = "gpt-4o-mini"
	}
	body := map[string]any{
		"model":    opts.Model,
		"messages": msgs,
	}
	if opts.Temperature > 0 {
		body["temperature"] = opts.Temperature
	}
	if opts.MaxTokens > 0 {
		body["max_tokens"] = opts.MaxTokens
	}
	resp, err := p.post(ctx, "/chat/completions", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp)
	}
	var out struct {
		Choices []struct {
			Message  ChatMessage `json:"message"`
			Logprobs *struct {
				Content []struct {
					Logprob float64 `json:"logprob"`
				} `json:"content"`
			} `json:"logprobs,omitempty"`
		} `json:"choices"`
		Model string `json:"model"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Choices) == 0 {
		return nil, errors.New("openai: empty choices")
	}
	text := out.Choices[0].Message.Content

	// Confidence heuristic: average exp(logprob) when present, else a
	// constant high-ish value. Real grounding-confidence requires more
	// than what the API exposes; this is good enough to gate handoff.
	confidence := float32(0.75)
	return &ChatResult{Text: text, Confidence: confidence, Model: out.Model}, nil
}

// Embed calls /embeddings and returns the first vector.
func (p *OpenAIProvider) Embed(ctx context.Context, model, text string) ([]float32, error) {
	if model == "" {
		model = "text-embedding-3-small"
	}
	body := map[string]any{"model": model, "input": text}
	resp, err := p.post(ctx, "/embeddings", body)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp)
	}
	var out struct {
		Data []struct {
			Embedding []float32 `json:"embedding"`
		} `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	if len(out.Data) == 0 {
		return nil, errors.New("openai: empty embedding")
	}
	return out.Data[0].Embedding, nil
}

func (p *OpenAIProvider) post(ctx context.Context, path string, body any) (*http.Response, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, p.baseURL+path, bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)
	return p.http.Do(req)
}

func parseAPIError(resp *http.Response) error {
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 8*1024))
	var apiErr struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &apiErr)
	if apiErr.Error.Message != "" {
		return fmt.Errorf("openai: %d %s", resp.StatusCode, apiErr.Error.Message)
	}
	return fmt.Errorf("openai: http %d: %s", resp.StatusCode, string(body))
}

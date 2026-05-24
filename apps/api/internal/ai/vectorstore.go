package ai

import (
	"context"
	"math"
	"sort"
)

// SearchResult is one hit returned by VectorStore.Search.
type SearchResult struct {
	ChunkID    string  `json:"chunk_id"`
	DocumentID string  `json:"document_id"`
	Position   int     `json:"position"`
	Content    string  `json:"content"`
	Score      float32 `json:"score"`
}

// VectorStore is a workspace-scoped vector index. The default
// implementation lives in `pgArrayStore`, which fetches all chunks
// of a workspace and computes cosine similarity in Go — fine for
// hundreds of chunks. Swap to pgvector by implementing this interface.
type VectorStore interface {
	Upsert(ctx context.Context, chunk StoredChunk) error
	Search(ctx context.Context, workspaceID string, query []float32, limit int) ([]SearchResult, error)
}

// StoredChunk is a chunk ready for persistence.
type StoredChunk struct {
	ID          string
	DocumentID  string
	WorkspaceID string
	Position    int
	Content     string
	Tokens      int
	Embedding   []float32
}

// Candidate is the slim row the in-Go store receives from Postgres.
type Candidate struct {
	ChunkID    string
	DocumentID string
	Position   int
	Content    string
	Embedding  []float32
}

// CosineSimilarity returns the cosine similarity of two equally-sized
// float32 vectors. Returns 0 when either vector is degenerate.
func CosineSimilarity(a, b []float32) float32 {
	if len(a) == 0 || len(a) != len(b) {
		return 0
	}
	var dot, na, nb float64
	for i := range a {
		af, bf := float64(a[i]), float64(b[i])
		dot += af * bf
		na += af * af
		nb += bf * bf
	}
	if na == 0 || nb == 0 {
		return 0
	}
	return float32(dot / (math.Sqrt(na) * math.Sqrt(nb)))
}

// RankCandidates sorts candidates by similarity to the query and returns
// the top `limit`. This helper makes it easy to plug in any storage
// backend that can produce a candidate set.
func RankCandidates(query []float32, candidates []Candidate, limit int) []SearchResult {
	scored := make([]SearchResult, 0, len(candidates))
	for _, c := range candidates {
		scored = append(scored, SearchResult{
			ChunkID:    c.ChunkID,
			DocumentID: c.DocumentID,
			Position:   c.Position,
			Content:    c.Content,
			Score:      CosineSimilarity(query, c.Embedding),
		})
	}
	sort.Slice(scored, func(i, j int) bool {
		return scored[i].Score > scored[j].Score
	})
	if limit > 0 && len(scored) > limit {
		scored = scored[:limit]
	}
	return scored
}

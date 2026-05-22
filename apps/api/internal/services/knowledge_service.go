package services

import (
	"context"
	"errors"
	"fmt"
	"log"
	"strings"

	"github.com/aichat/api/internal/ai"
	"github.com/aichat/api/internal/models"
	"github.com/aichat/api/internal/repositories"
)

// Knowledge service errors.
var (
	ErrEmptyKnowledge = errors.New("knowledge document is empty")
)

// KnowledgeService implements document upload + chunked embedding +
// retrieval helpers used by RAG.
type KnowledgeService struct {
	ai        *repositories.AIRepository
	llm       ai.LLM
	chunkSize int
	plan      PlanEnforcer
}

// NewKnowledgeService constructs a KnowledgeService.
func NewKnowledgeService(repo *repositories.AIRepository, llm ai.LLM, chunkSize int) *KnowledgeService {
	if chunkSize <= 0 {
		chunkSize = 800
	}
	return &KnowledgeService{ai: repo, llm: llm, chunkSize: chunkSize}
}

// SetPlanEnforcer wires plan-limit enforcement. Optional (nil = no limits).
func (s *KnowledgeService) SetPlanEnforcer(p PlanEnforcer) { s.plan = p }

// IngestInput is the payload for /knowledge POST.
type IngestInput struct {
	WorkspaceID    string
	ActorID        string
	Title          string
	SourceKind     models.KnowledgeSource
	SourceURL      *string
	MimeType       *string
	RawContent     string
	EmbeddingModel string
}

// Ingest persists the document then synchronously chunks + embeds it.
// Synchronous because workspace knowledge bases are bounded; for very
// large catalogs this would belong on the worker queue.
func (s *KnowledgeService) Ingest(ctx context.Context, in IngestInput) (*models.KnowledgeDocument, error) {
	title := strings.TrimSpace(in.Title)
	content := strings.TrimSpace(in.RawContent)
	if title == "" {
		title = "Untitled"
	}
	if content == "" {
		return nil, ErrEmptyKnowledge
	}

	// Knowledge base requires the AI Chatbot feature + sits under a
	// per-plan document limit.
	if err := ensureFeature(s.plan, ctx, in.WorkspaceID, FeatureAIChatbot); err != nil {
		return nil, err
	}
	existing, err := s.ai.ListKnowledgeDocuments(ctx, in.WorkspaceID)
	if err != nil {
		return nil, err
	}
	if err := ensureCanAdd(s.plan, ctx, in.WorkspaceID, ResourceKnowledgeDocuments, len(existing)); err != nil {
		return nil, err
	}

	actor := in.ActorID
	rawCopy := content
	doc, err := s.ai.CreateKnowledgeDocument(ctx, repositories.CreateKnowledgeDocumentParams{
		WorkspaceID: in.WorkspaceID,
		Title:       title,
		SourceKind:  in.SourceKind,
		SourceURL:   in.SourceURL,
		MimeType:    in.MimeType,
		RawContent:  &rawCopy,
		CreatedBy:   &actor,
	})
	if err != nil {
		return nil, err
	}

	chunks := ai.ChunkText(content, s.chunkSize)
	if len(chunks) == 0 {
		errMsg := "no chunks produced"
		_ = s.ai.UpdateKnowledgeDocumentStatus(ctx, doc.ID, models.KnowledgeFailed, 0, &errMsg)
		return doc, ErrEmptyKnowledge
	}

	for _, c := range chunks {
		embedding, err := s.llm.Embed(ctx, in.EmbeddingModel, c.Content)
		if err != nil {
			errMsg := fmt.Sprintf("embed: %v", err)
			_ = s.ai.UpdateKnowledgeDocumentStatus(ctx, doc.ID, models.KnowledgeFailed, 0, &errMsg)
			return doc, err
		}
		if err := s.ai.CreateChunk(ctx, ai.StoredChunk{
			DocumentID:  doc.ID,
			WorkspaceID: in.WorkspaceID,
			Position:    c.Position,
			Content:     c.Content,
			Tokens:      c.Tokens,
			Embedding:   embedding,
		}); err != nil {
			errMsg := fmt.Sprintf("store chunk: %v", err)
			_ = s.ai.UpdateKnowledgeDocumentStatus(ctx, doc.ID, models.KnowledgeFailed, 0, &errMsg)
			return doc, err
		}
	}

	_ = s.ai.UpdateKnowledgeDocumentStatus(ctx, doc.ID, models.KnowledgeReady, len(chunks), nil)
	doc.Status = models.KnowledgeReady
	doc.ChunkCount = len(chunks)
	return doc, nil
}

// List returns the documents of a workspace.
func (s *KnowledgeService) List(ctx context.Context, workspaceID string) ([]models.KnowledgeDocument, error) {
	return s.ai.ListKnowledgeDocuments(ctx, workspaceID)
}

// Get returns one document.
func (s *KnowledgeService) Get(ctx context.Context, id string) (*models.KnowledgeDocument, error) {
	return s.ai.GetKnowledgeDocumentByID(ctx, id)
}

// Delete removes a document and its chunks.
func (s *KnowledgeService) Delete(ctx context.Context, id string) error {
	return s.ai.DeleteKnowledgeDocument(ctx, id)
}

// Search returns the top-K chunks for a query string within a workspace.
// The query is embedded with the same model used at ingestion time.
func (s *KnowledgeService) Search(ctx context.Context, workspaceID, embeddingModel, query string, limit int) ([]ai.SearchResult, error) {
	if strings.TrimSpace(query) == "" {
		return []ai.SearchResult{}, nil
	}
	embedding, err := s.llm.Embed(ctx, embeddingModel, query)
	if err != nil {
		log.Printf("knowledge: embed query: %v", err)
		return nil, err
	}
	if limit <= 0 {
		limit = 4
	}
	return s.ai.SearchChunks(ctx, workspaceID, embedding, limit)
}

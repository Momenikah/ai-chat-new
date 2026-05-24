package repositories

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
	"github.com/aichat/api/internal/ai"
	"github.com/aichat/api/internal/models"
)

// AIRepository handles persistence for AI agents, knowledge documents +
// chunks, bot reply logs, and prompt reviews. It also exposes the vector
// search used by RAG retrieval.
type AIRepository struct {
	db DBTX
}

// NewAIRepository constructs an AIRepository.
func NewAIRepository(db DBTX) *AIRepository {
	return &AIRepository{db: db}
}

const aiAgentColumns = `
	id::text, workspace_id::text, name, tone, language, system_prompt,
	fallback_message, confidence_threshold, enabled, enabled_channel_ids,
	handoff_enabled, model, embedding_model, prompt_approved,
	created_at, updated_at`

const knowledgeDocColumns = `
	id::text, workspace_id::text, title, source_kind::text, source_url,
	mime_type, raw_content, status::text, chunk_count, error_message,
	created_by::text, created_at, updated_at`

// --- AI agent ----------------------------------------------------------

// UpsertAIAgentParams holds inputs for inserting / updating an agent.
type UpsertAIAgentParams struct {
	WorkspaceID         string
	Name                string
	Tone                string
	Language            string
	SystemPrompt        string
	FallbackMessage     string
	ConfidenceThreshold float32
	Enabled             bool
	EnabledChannelIDs   json.RawMessage
	HandoffEnabled      bool
	Model               string
	EmbeddingModel      string
}

// UpsertAIAgent inserts or updates the workspace's agent. Saving any
// field resets prompt_approved to FALSE so a fresh review is required.
func (r *AIRepository) UpsertAIAgent(ctx context.Context, p UpsertAIAgentParams) (*models.AIAgent, error) {
	if len(p.EnabledChannelIDs) == 0 {
		p.EnabledChannelIDs = json.RawMessage(`[]`)
	}
	if p.Model == "" {
		p.Model = "gpt-4o-mini"
	}
	if p.EmbeddingModel == "" {
		p.EmbeddingModel = "text-embedding-3-small"
	}
	const q = `
		INSERT INTO ai_agents (
			workspace_id, name, tone, language, system_prompt, fallback_message,
			confidence_threshold, enabled, enabled_channel_ids, handoff_enabled,
			model, embedding_model
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		ON CONFLICT (workspace_id) DO UPDATE
		SET name                 = EXCLUDED.name,
		    tone                 = EXCLUDED.tone,
		    language             = EXCLUDED.language,
		    system_prompt        = EXCLUDED.system_prompt,
		    fallback_message     = EXCLUDED.fallback_message,
		    confidence_threshold = EXCLUDED.confidence_threshold,
		    enabled              = EXCLUDED.enabled,
		    enabled_channel_ids  = EXCLUDED.enabled_channel_ids,
		    handoff_enabled      = EXCLUDED.handoff_enabled,
		    model                = EXCLUDED.model,
		    embedding_model      = EXCLUDED.embedding_model,
		    prompt_approved      = FALSE,
		    updated_at           = now()
		RETURNING ` + aiAgentColumns
	return scanAIAgent(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Name, p.Tone, p.Language, p.SystemPrompt, p.FallbackMessage,
		p.ConfidenceThreshold, p.Enabled, p.EnabledChannelIDs, p.HandoffEnabled,
		p.Model, p.EmbeddingModel,
	))
}

// GetAIAgentByWorkspace fetches the workspace's agent.
func (r *AIRepository) GetAIAgentByWorkspace(ctx context.Context, workspaceID string) (*models.AIAgent, error) {
	const q = `SELECT ` + aiAgentColumns + ` FROM ai_agents WHERE workspace_id = $1`
	return scanAIAgent(r.db.QueryRow(ctx, q, workspaceID))
}

// SetAIAgentApproved flips the prompt-approved flag.
func (r *AIRepository) SetAIAgentApproved(ctx context.Context, workspaceID string, approved bool) error {
	_, err := r.db.Exec(ctx,
		`UPDATE ai_agents SET prompt_approved = $2, updated_at = now() WHERE workspace_id = $1`,
		workspaceID, approved)
	return err
}

// --- prompt reviews ----------------------------------------------------

// CreatePromptReview persists a snapshot of the system prompt for audit.
func (r *AIRepository) CreatePromptReview(ctx context.Context, agentID, workspaceID, prompt string, reviewerID *string, status models.PromptReviewStatus, notes *string) (*models.AIPromptReview, error) {
	const q = `INSERT INTO ai_prompt_reviews
		(ai_agent_id, workspace_id, prompt, reviewer_id, status, notes)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id::text, ai_agent_id::text, workspace_id::text, prompt,
		          reviewer_id::text, status::text, notes, created_at, updated_at`
	var rv models.AIPromptReview
	var st string
	if err := r.db.QueryRow(ctx, q,
		agentID, workspaceID, prompt, reviewerID, string(status), notes,
	).Scan(
		&rv.ID, &rv.AIAgentID, &rv.WorkspaceID, &rv.Prompt,
		&rv.ReviewerID, &st, &rv.Notes, &rv.CreatedAt, &rv.UpdatedAt,
	); err != nil {
		return nil, err
	}
	rv.Status = models.PromptReviewStatus(st)
	return &rv, nil
}

// ListPromptReviews returns the most recent reviews of an agent.
func (r *AIRepository) ListPromptReviews(ctx context.Context, agentID string) ([]models.AIPromptReview, error) {
	const q = `SELECT id::text, ai_agent_id::text, workspace_id::text, prompt,
		reviewer_id::text, status::text, notes, created_at, updated_at
		FROM ai_prompt_reviews WHERE ai_agent_id = $1
		ORDER BY created_at DESC LIMIT 50`
	rows, err := r.db.Query(ctx, q, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.AIPromptReview{}
	for rows.Next() {
		var rv models.AIPromptReview
		var st string
		if err := rows.Scan(
			&rv.ID, &rv.AIAgentID, &rv.WorkspaceID, &rv.Prompt,
			&rv.ReviewerID, &st, &rv.Notes, &rv.CreatedAt, &rv.UpdatedAt,
		); err != nil {
			return nil, err
		}
		rv.Status = models.PromptReviewStatus(st)
		out = append(out, rv)
	}
	return out, rows.Err()
}

// --- knowledge documents ----------------------------------------------

// CreateKnowledgeDocumentParams holds inputs for inserting a doc.
type CreateKnowledgeDocumentParams struct {
	WorkspaceID string
	Title       string
	SourceKind  models.KnowledgeSource
	SourceURL   *string
	MimeType    *string
	RawContent  *string
	CreatedBy   *string
}

// CreateKnowledgeDocument inserts a doc in `processing` state.
func (r *AIRepository) CreateKnowledgeDocument(ctx context.Context, p CreateKnowledgeDocumentParams) (*models.KnowledgeDocument, error) {
	const q = `INSERT INTO knowledge_documents
		(workspace_id, title, source_kind, source_url, mime_type, raw_content, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING ` + knowledgeDocColumns
	return scanKnowledgeDoc(r.db.QueryRow(ctx, q,
		p.WorkspaceID, p.Title, string(p.SourceKind),
		p.SourceURL, p.MimeType, p.RawContent, p.CreatedBy,
	))
}

// ListKnowledgeDocuments returns the docs of a workspace.
func (r *AIRepository) ListKnowledgeDocuments(ctx context.Context, workspaceID string) ([]models.KnowledgeDocument, error) {
	const q = `SELECT ` + knowledgeDocColumns + ` FROM knowledge_documents
		WHERE workspace_id = $1 ORDER BY created_at DESC`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.KnowledgeDocument{}
	for rows.Next() {
		d, err := scanKnowledgeDocRow(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, *d)
	}
	return out, rows.Err()
}

// GetKnowledgeDocumentByID fetches one doc.
func (r *AIRepository) GetKnowledgeDocumentByID(ctx context.Context, id string) (*models.KnowledgeDocument, error) {
	const q = `SELECT ` + knowledgeDocColumns + ` FROM knowledge_documents WHERE id = $1`
	return scanKnowledgeDoc(r.db.QueryRow(ctx, q, id))
}

// UpdateKnowledgeDocumentStatus flips status/chunk_count/error.
func (r *AIRepository) UpdateKnowledgeDocumentStatus(ctx context.Context, id string, status models.KnowledgeStatus, chunkCount int, errMsg *string) error {
	_, err := r.db.Exec(ctx, `
		UPDATE knowledge_documents
		SET status = $2, chunk_count = $3, error_message = $4, updated_at = now()
		WHERE id = $1`, id, string(status), chunkCount, errMsg)
	return err
}

// DeleteKnowledgeDocument removes a doc (cascades to chunks).
func (r *AIRepository) DeleteKnowledgeDocument(ctx context.Context, id string) error {
	_, err := r.db.Exec(ctx, `DELETE FROM knowledge_documents WHERE id = $1`, id)
	return err
}

// --- knowledge chunks (vector store) ----------------------------------

// CreateChunk inserts one knowledge chunk with its embedding.
func (r *AIRepository) CreateChunk(ctx context.Context, c ai.StoredChunk) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO knowledge_chunks
			(document_id, workspace_id, position, content, tokens, embedding, dim)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		c.DocumentID, c.WorkspaceID, c.Position, c.Content, c.Tokens,
		c.Embedding, len(c.Embedding))
	return err
}

// SearchChunks loads all chunks of a workspace matching the query
// dimension and returns the top `limit` by cosine similarity computed
// in Go.
//
// Workloads beyond ~10k chunks should swap this implementation for a
// pgvector-backed one (same VectorStore interface).
func (r *AIRepository) SearchChunks(ctx context.Context, workspaceID string, query []float32, limit int) ([]ai.SearchResult, error) {
	const q = `SELECT id::text, document_id::text, position, content, embedding
		FROM knowledge_chunks
		WHERE workspace_id = $1 AND dim = $2`
	rows, err := r.db.Query(ctx, q, workspaceID, len(query))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	cands := []ai.Candidate{}
	for rows.Next() {
		var c ai.Candidate
		if err := rows.Scan(&c.ChunkID, &c.DocumentID, &c.Position, &c.Content, &c.Embedding); err != nil {
			return nil, err
		}
		cands = append(cands, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return ai.RankCandidates(query, cands, limit), nil
}

// --- bot reply logs ----------------------------------------------------

// CreateBotReplyLogParams captures one auto-reply attempt.
type CreateBotReplyLogParams struct {
	WorkspaceID      string
	ConversationID   *string
	InboundMessageID *string
	ReplyMessageID   *string
	InboundText      *string
	ResponseText     *string
	Confidence       float32
	HandedOff        bool
	ChunkIDs         json.RawMessage
	Model            *string
	ErrorMessage     *string
}

// CreateBotReplyLog persists a log row.
func (r *AIRepository) CreateBotReplyLog(ctx context.Context, p CreateBotReplyLogParams) error {
	if len(p.ChunkIDs) == 0 {
		p.ChunkIDs = json.RawMessage(`[]`)
	}
	_, err := r.db.Exec(ctx, `
		INSERT INTO bot_reply_logs (
			workspace_id, conversation_id, inbound_message_id, reply_message_id,
			inbound_text, response_text, confidence, handed_off, chunk_ids,
			model, error_message
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
		p.WorkspaceID, p.ConversationID, p.InboundMessageID, p.ReplyMessageID,
		p.InboundText, p.ResponseText, p.Confidence, p.HandedOff,
		p.ChunkIDs, p.Model, p.ErrorMessage,
	)
	return err
}

// ListBotReplyLogs returns the most recent reply logs of a workspace.
func (r *AIRepository) ListBotReplyLogs(ctx context.Context, workspaceID string) ([]models.BotReplyLog, error) {
	const q = `SELECT id::text, workspace_id::text, conversation_id::text,
		inbound_message_id::text, reply_message_id::text, inbound_text,
		response_text, confidence, handed_off, chunk_ids, model, error_message, created_at
		FROM bot_reply_logs WHERE workspace_id = $1
		ORDER BY created_at DESC LIMIT 100`
	rows, err := r.db.Query(ctx, q, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []models.BotReplyLog{}
	for rows.Next() {
		var l models.BotReplyLog
		if err := rows.Scan(
			&l.ID, &l.WorkspaceID, &l.ConversationID,
			&l.InboundMessageID, &l.ReplyMessageID, &l.InboundText,
			&l.ResponseText, &l.Confidence, &l.HandedOff, &l.ChunkIDs,
			&l.Model, &l.ErrorMessage, &l.CreatedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, l)
	}
	return out, rows.Err()
}

// --- scan helpers ------------------------------------------------------

func scanAIAgent(row pgx.Row) (*models.AIAgent, error) {
	var a models.AIAgent
	err := row.Scan(
		&a.ID, &a.WorkspaceID, &a.Name, &a.Tone, &a.Language, &a.SystemPrompt,
		&a.FallbackMessage, &a.ConfidenceThreshold, &a.Enabled, &a.EnabledChannelIDs,
		&a.HandoffEnabled, &a.Model, &a.EmbeddingModel, &a.PromptApproved,
		&a.CreatedAt, &a.UpdatedAt,
	)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return &a, nil
}

func scanKnowledgeDoc(row pgx.Row) (*models.KnowledgeDocument, error) {
	d, err := scanKnowledgeDocRow(row)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return d, nil
}

func scanKnowledgeDocRow(row pgx.Row) (*models.KnowledgeDocument, error) {
	var d models.KnowledgeDocument
	var source, status string
	if err := row.Scan(
		&d.ID, &d.WorkspaceID, &d.Title, &source, &d.SourceURL,
		&d.MimeType, &d.RawContent, &status, &d.ChunkCount, &d.ErrorMessage,
		&d.CreatedBy, &d.CreatedAt, &d.UpdatedAt,
	); err != nil {
		return nil, err
	}
	d.SourceKind = models.KnowledgeSource(source)
	d.Status = models.KnowledgeStatus(status)
	return &d, nil
}

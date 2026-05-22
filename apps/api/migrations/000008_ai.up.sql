-- =============================================================================
-- AI Chat — Part 9: AI chatbot + knowledge base
--
-- The embedding column is `real[]` (Postgres native float array) so the
-- system works on a vanilla Postgres without pgvector. The Go-side
-- VectorStore interface keeps the door open for pgvector later — just
-- swap the implementation; no schema migration on top is required for
-- the demo workload.
-- =============================================================================

CREATE TYPE knowledge_source AS ENUM ('upload', 'manual', 'url');
CREATE TYPE knowledge_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE prompt_review_status AS ENUM ('pending', 'approved', 'rejected');

-- --- ai_agents ---------------------------------------------------------------
-- One row per workspace (unique constraint). The bot is gated by
-- `enabled` AND `prompt_approved` together.
CREATE TABLE ai_agents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID         NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    name                  TEXT         NOT NULL DEFAULT 'Asisten AI',
    tone                  TEXT         NOT NULL DEFAULT 'profesional dan ramah',
    language              TEXT         NOT NULL DEFAULT 'id',
    system_prompt         TEXT         NOT NULL DEFAULT '',
    fallback_message      TEXT         NOT NULL DEFAULT 'Maaf, saya akan menghubungkan Anda dengan tim kami.',
    confidence_threshold  REAL         NOT NULL DEFAULT 0.6,
    enabled               BOOLEAN      NOT NULL DEFAULT FALSE,
    enabled_channel_ids   JSONB        NOT NULL DEFAULT '[]'::jsonb,
    handoff_enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    model                 TEXT         NOT NULL DEFAULT 'gpt-4o-mini',
    embedding_model       TEXT         NOT NULL DEFAULT 'text-embedding-3-small',
    prompt_approved       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_ai_agents_updated_at
    BEFORE UPDATE ON ai_agents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- knowledge_documents -----------------------------------------------------
CREATE TABLE knowledge_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID              NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title           TEXT              NOT NULL,
    source_kind     knowledge_source  NOT NULL,
    source_url      TEXT,
    mime_type       TEXT,
    raw_content     TEXT,
    status          knowledge_status  NOT NULL DEFAULT 'processing',
    chunk_count     INT               NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_by      UUID              REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_documents_workspace ON knowledge_documents (workspace_id, created_at DESC);
CREATE TRIGGER trg_knowledge_documents_updated_at
    BEFORE UPDATE ON knowledge_documents
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- knowledge_chunks --------------------------------------------------------
CREATE TABLE knowledge_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID         NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    position      INT          NOT NULL DEFAULT 0,
    content       TEXT         NOT NULL,
    tokens        INT          NOT NULL DEFAULT 0,
    embedding     REAL[],
    dim           INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_knowledge_chunks_workspace_dim ON knowledge_chunks (workspace_id, dim);
CREATE INDEX idx_knowledge_chunks_document ON knowledge_chunks (document_id, position);

-- --- bot_reply_logs ----------------------------------------------------------
CREATE TABLE bot_reply_logs (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id   UUID         REFERENCES conversations(id) ON DELETE SET NULL,
    inbound_message_id UUID        REFERENCES messages(id) ON DELETE SET NULL,
    reply_message_id  UUID         REFERENCES messages(id) ON DELETE SET NULL,
    inbound_text      TEXT,
    response_text     TEXT,
    confidence        REAL         NOT NULL DEFAULT 0,
    handed_off        BOOLEAN      NOT NULL DEFAULT FALSE,
    chunk_ids         JSONB        NOT NULL DEFAULT '[]'::jsonb,
    model             TEXT,
    error_message     TEXT,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_bot_reply_logs_workspace ON bot_reply_logs (workspace_id, created_at DESC);
CREATE INDEX idx_bot_reply_logs_conversation ON bot_reply_logs (conversation_id, created_at DESC);

-- --- ai_prompt_reviews -------------------------------------------------------
-- Audit / approval trail for system prompt changes.
CREATE TABLE ai_prompt_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_agent_id   UUID                  NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    workspace_id  UUID                  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    prompt        TEXT                  NOT NULL,
    reviewer_id   UUID                  REFERENCES users(id) ON DELETE SET NULL,
    status        prompt_review_status  NOT NULL DEFAULT 'pending',
    notes         TEXT,
    created_at    TIMESTAMPTZ           NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ           NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_prompt_reviews_agent ON ai_prompt_reviews (ai_agent_id, created_at DESC);
CREATE TRIGGER trg_ai_prompt_reviews_updated_at
    BEFORE UPDATE ON ai_prompt_reviews
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- conversations: ai disabling flag ----------------------------------------
-- Auto-disable AI on a conversation when an agent takes over manually.
ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS ai_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- AI Chat — schema for `sqlc generate` (Part 1 + 2 + 3)
-- Keep in sync with migrations/000001 + 000002 + 000003.
-- =============================================================================

CREATE TYPE member_role         AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER');
CREATE TYPE member_status       AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE invitation_status   AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE channel_type        AS ENUM ('whatsapp', 'instagram', 'messenger');
CREATE TYPE channel_status      AS ENUM ('disconnected', 'pending', 'connected', 'error');
CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'spam');
CREATE TYPE message_direction   AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status      AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE message_kind        AS ENUM ('text', 'image', 'file', 'audio', 'video', 'system');

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name           TEXT NOT NULL,
    email          TEXT NOT NULL,
    password_hash  TEXT NOT NULL,
    avatar_url     TEXT,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at  TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspaces (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    slug         TEXT NOT NULL UNIQUE,
    logo_url     TEXT,
    brand_color  TEXT NOT NULL DEFAULT '#18181b',
    timezone     TEXT NOT NULL DEFAULT 'Asia/Jakarta',
    owner_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE workspace_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          member_role NOT NULL DEFAULT 'AGENT',
    status        member_status NOT NULL DEFAULT 'active',
    invited_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);

CREATE TABLE workspace_invitations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    role          member_role NOT NULL DEFAULT 'AGENT',
    token         TEXT NOT NULL UNIQUE,
    status        invitation_status NOT NULL DEFAULT 'pending',
    invited_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    accepted_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE channels (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type               channel_type NOT NULL,
    name               TEXT NOT NULL,
    status             channel_status NOT NULL DEFAULT 'disconnected',
    external_id        TEXT,
    error_message      TEXT,
    last_connected_at  TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE channel_credentials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
    ciphertext  BYTEA NOT NULL,
    nonce       BYTEA NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE upload_files (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    kind           TEXT NOT NULL DEFAULT 'media',
    original_name  TEXT NOT NULL,
    stored_path    TEXT NOT NULL,
    mime_type      TEXT NOT NULL,
    size_bytes     BIGINT NOT NULL DEFAULT 0,
    url            TEXT NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contacts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name             TEXT NOT NULL,
    phone            TEXT,
    email            TEXT,
    avatar_url       TEXT,
    external_source  channel_type,
    external_id      TEXT,
    metadata         JSONB NOT NULL DEFAULT '{}'::jsonb,
    location         TEXT,
    company          TEXT,
    birthday         DATE,
    notes            TEXT,
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id            UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    contact_id            UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status                conversation_status NOT NULL DEFAULT 'open',
    assigned_agent_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    last_message_at       TIMESTAMPTZ,
    last_message_preview  TEXT,
    unread_count          INT NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    direction        message_direction NOT NULL,
    kind             message_kind NOT NULL DEFAULT 'text',
    body             TEXT,
    status           message_status NOT NULL DEFAULT 'sent',
    sender_user_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    external_id      TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_attachments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id     UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url            TEXT NOT NULL,
    mime_type      TEXT,
    size_bytes     BIGINT NOT NULL DEFAULT 0,
    thumbnail_url  TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE conversation_assignments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE internal_notes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    author_id        UUID REFERENCES users(id) ON DELETE SET NULL,
    body             TEXT NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    color         TEXT NOT NULL DEFAULT '#71717a',
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contact_tags (
    contact_id  UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);

CREATE TABLE agent_presence (
    user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status         TEXT NOT NULL DEFAULT 'online',
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, workspace_id)
);

CREATE TABLE segments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    description   TEXT,
    color         TEXT NOT NULL DEFAULT '#71717a',
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE segment_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    field       TEXT NOT NULL,
    operator    TEXT NOT NULL,
    value       TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE contact_activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id    UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id      UUID REFERENCES users(id) ON DELETE SET NULL,
    kind          TEXT NOT NULL,
    body          TEXT,
    metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE webhook_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id    UUID REFERENCES channels(id) ON DELETE SET NULL,
    provider      TEXT NOT NULL,
    direction     TEXT NOT NULL DEFAULT 'incoming',
    event_type    TEXT,
    status_code   INT NOT NULL DEFAULT 200,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    received_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE template_category AS ENUM ('marketing', 'utility', 'authentication');
CREATE TYPE template_status   AS ENUM ('draft', 'pending', 'approved', 'rejected');

CREATE TABLE quick_replies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    shortcut      TEXT NOT NULL,
    body          TEXT NOT NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    category          template_category NOT NULL DEFAULT 'utility',
    status            template_status NOT NULL DEFAULT 'draft',
    language          TEXT NOT NULL DEFAULT 'id',
    header_kind       TEXT,
    header_content    TEXT,
    body              TEXT NOT NULL,
    footer            TEXT,
    buttons           JSONB NOT NULL DEFAULT '[]'::jsonb,
    external_id       TEXT,
    submitted_at      TIMESTAMPTZ,
    approved_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_variables (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id   UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    label         TEXT,
    sample_value  TEXT,
    position      INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE interactive_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    kind          TEXT NOT NULL,
    payload       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE template_usage_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id      UUID NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id  UUID REFERENCES conversations(id) ON DELETE SET NULL,
    used_by          UUID REFERENCES users(id) ON DELETE SET NULL,
    variables        JSONB NOT NULL DEFAULT '{}'::jsonb,
    rendered_body    TEXT,
    used_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE broadcast_status AS ENUM ('draft','scheduled','sending','completed','failed','cancelled');
CREATE TYPE recipient_status AS ENUM ('queued','sent','delivered','read','failed','skipped');

CREATE TABLE broadcast_campaigns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id        UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    template_id       UUID REFERENCES message_templates(id) ON DELETE SET NULL,
    name              TEXT NOT NULL,
    audience_kind     TEXT NOT NULL,
    audience_filter   JSONB NOT NULL DEFAULT '{}'::jsonb,
    body_override     TEXT,
    variables         JSONB NOT NULL DEFAULT '{}'::jsonb,
    status            broadcast_status NOT NULL DEFAULT 'draft',
    rate_per_minute   INT NOT NULL DEFAULT 60,
    scheduled_at      TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    total_recipients  INT NOT NULL DEFAULT 0,
    sent_count        INT NOT NULL DEFAULT 0,
    delivered_count   INT NOT NULL DEFAULT 0,
    read_count        INT NOT NULL DEFAULT 0,
    failed_count      INT NOT NULL DEFAULT 0,
    reply_count       INT NOT NULL DEFAULT 0,
    created_by        UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE broadcast_recipients (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id          UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    workspace_id         UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    contact_id           UUID REFERENCES contacts(id) ON DELETE SET NULL,
    name                 TEXT,
    phone                TEXT,
    external_id          TEXT,
    variables            JSONB NOT NULL DEFAULT '{}'::jsonb,
    rendered_body        TEXT,
    status               recipient_status NOT NULL DEFAULT 'queued',
    message_id           UUID REFERENCES messages(id) ON DELETE SET NULL,
    external_message_id  TEXT,
    attempts             INT NOT NULL DEFAULT 0,
    last_error           TEXT,
    enqueued_at          TIMESTAMPTZ,
    sent_at              TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    read_at              TIMESTAMPTZ,
    failed_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE broadcast_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id   UUID NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    recipient_id  UUID REFERENCES broadcast_recipients(id) ON DELETE CASCADE,
    event         TEXT NOT NULL,
    detail        TEXT,
    occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE message_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,
    payload         JSONB NOT NULL,
    status          TEXT NOT NULL DEFAULT 'queued',
    attempts        INT NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE knowledge_source AS ENUM ('upload', 'manual', 'url');
CREATE TYPE knowledge_status AS ENUM ('processing', 'ready', 'failed');
CREATE TYPE prompt_review_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE ai_agents (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    name                  TEXT NOT NULL DEFAULT 'Asisten AI',
    tone                  TEXT NOT NULL DEFAULT 'profesional dan ramah',
    language              TEXT NOT NULL DEFAULT 'id',
    system_prompt         TEXT NOT NULL DEFAULT '',
    fallback_message      TEXT NOT NULL DEFAULT 'Maaf, saya akan menghubungkan Anda dengan tim kami.',
    confidence_threshold  REAL NOT NULL DEFAULT 0.6,
    enabled               BOOLEAN NOT NULL DEFAULT FALSE,
    enabled_channel_ids   JSONB NOT NULL DEFAULT '[]'::jsonb,
    handoff_enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    model                 TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    embedding_model       TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    prompt_approved       BOOLEAN NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_documents (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    source_kind     knowledge_source NOT NULL,
    source_url      TEXT,
    mime_type       TEXT,
    raw_content     TEXT,
    status          knowledge_status NOT NULL DEFAULT 'processing',
    chunk_count     INT NOT NULL DEFAULT 0,
    error_message   TEXT,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE knowledge_chunks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id   UUID NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    position      INT NOT NULL DEFAULT 0,
    content       TEXT NOT NULL,
    tokens        INT NOT NULL DEFAULT 0,
    embedding     REAL[],
    dim           INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE bot_reply_logs (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id    UUID REFERENCES conversations(id) ON DELETE SET NULL,
    inbound_message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
    reply_message_id   UUID REFERENCES messages(id) ON DELETE SET NULL,
    inbound_text       TEXT,
    response_text      TEXT,
    confidence         REAL NOT NULL DEFAULT 0,
    handed_off         BOOLEAN NOT NULL DEFAULT FALSE,
    chunk_ids          JSONB NOT NULL DEFAULT '[]'::jsonb,
    model              TEXT,
    error_message      TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE ai_prompt_reviews (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ai_agent_id   UUID NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    prompt        TEXT NOT NULL,
    reviewer_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    status        prompt_review_status NOT NULL DEFAULT 'pending',
    notes         TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conversations ADD COLUMN ai_disabled BOOLEAN NOT NULL DEFAULT FALSE;

-- =============================================================================
-- AI Chat — Part 3: unified inbox
-- Tables: contacts, conversations, messages, message_attachments,
--         conversation_assignments, internal_notes, tags, contact_tags,
--         agent_presence
-- =============================================================================

CREATE TYPE conversation_status AS ENUM ('open', 'pending', 'resolved', 'spam');
CREATE TYPE message_direction   AS ENUM ('inbound', 'outbound');
CREATE TYPE message_status      AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE message_kind        AS ENUM ('text', 'image', 'file', 'audio', 'video', 'system');

-- --- contacts ----------------------------------------------------------------
CREATE TABLE contacts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name             TEXT         NOT NULL,
    phone            TEXT,
    email            TEXT,
    avatar_url       TEXT,
    external_source  channel_type,
    external_id      TEXT,
    metadata         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    last_seen_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_contacts_workspace_id ON contacts (workspace_id);
CREATE UNIQUE INDEX idx_contacts_external
    ON contacts (workspace_id, external_source, external_id)
    WHERE external_id IS NOT NULL;
CREATE TRIGGER trg_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- conversations -----------------------------------------------------------
CREATE TABLE conversations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID                 NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id            UUID                 NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    contact_id            UUID                 NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    status                conversation_status  NOT NULL DEFAULT 'open',
    assigned_agent_id     UUID                 REFERENCES users(id) ON DELETE SET NULL,
    last_message_at       TIMESTAMPTZ,
    last_message_preview  TEXT,
    unread_count          INT                  NOT NULL DEFAULT 0,
    created_at            TIMESTAMPTZ          NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ          NOT NULL DEFAULT now()
);
CREATE INDEX idx_conversations_workspace_status
    ON conversations (workspace_id, status, last_message_at DESC NULLS LAST);
CREATE INDEX idx_conversations_assigned ON conversations (assigned_agent_id);
CREATE INDEX idx_conversations_contact  ON conversations (contact_id);
CREATE TRIGGER trg_conversations_updated_at
    BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- messages ----------------------------------------------------------------
CREATE TABLE messages (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID               NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    workspace_id     UUID               NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    direction        message_direction  NOT NULL,
    kind             message_kind       NOT NULL DEFAULT 'text',
    body             TEXT,
    status           message_status     NOT NULL DEFAULT 'sent',
    sender_user_id   UUID               REFERENCES users(id) ON DELETE SET NULL,
    external_id      TEXT,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation_created ON messages (conversation_id, created_at);
CREATE INDEX idx_messages_workspace_created    ON messages (workspace_id, created_at DESC);

-- --- message_attachments -----------------------------------------------------
CREATE TABLE message_attachments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id     UUID         NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    url            TEXT         NOT NULL,
    mime_type      TEXT,
    size_bytes     BIGINT       NOT NULL DEFAULT 0,
    thumbnail_url  TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_attachments_message_id ON message_attachments (message_id);

-- --- conversation_assignments (audit log) ------------------------------------
CREATE TABLE conversation_assignments (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    assigned_to      UUID         REFERENCES users(id) ON DELETE SET NULL,
    assigned_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    assigned_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_assignments_conversation ON conversation_assignments (conversation_id, assigned_at DESC);

-- --- internal_notes ----------------------------------------------------------
CREATE TABLE internal_notes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID         NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    author_id        UUID         REFERENCES users(id) ON DELETE SET NULL,
    body             TEXT         NOT NULL,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_notes_conversation ON internal_notes (conversation_id, created_at DESC);
CREATE TRIGGER trg_internal_notes_updated_at
    BEFORE UPDATE ON internal_notes
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- tags / contact_tags -----------------------------------------------------
CREATE TABLE tags (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT         NOT NULL,
    color         TEXT         NOT NULL DEFAULT '#71717a',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_tags_workspace_name ON tags (workspace_id, lower(name));

CREATE TABLE contact_tags (
    contact_id  UUID         NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    tag_id      UUID         NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (contact_id, tag_id)
);
CREATE INDEX idx_contact_tags_contact ON contact_tags (contact_id);
CREATE INDEX idx_contact_tags_tag     ON contact_tags (tag_id);

-- --- agent_presence ----------------------------------------------------------
CREATE TABLE agent_presence (
    user_id        UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id   UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status         TEXT         NOT NULL DEFAULT 'online',
    last_seen_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, workspace_id)
);
CREATE INDEX idx_agent_presence_workspace ON agent_presence (workspace_id);
CREATE TRIGGER trg_agent_presence_updated_at
    BEFORE UPDATE ON agent_presence
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

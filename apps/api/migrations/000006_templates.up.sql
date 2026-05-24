-- =============================================================================
-- AI Chat — Part 7: message templates, quick replies, interactive messages
-- =============================================================================

CREATE TYPE template_category AS ENUM ('marketing', 'utility', 'authentication');
CREATE TYPE template_status   AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- --- quick_replies -----------------------------------------------------------
-- Short, agent-typed canned responses that can be inserted into the composer.
CREATE TABLE quick_replies (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    shortcut      TEXT         NOT NULL,
    body          TEXT         NOT NULL,
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_quick_replies_workspace_shortcut
    ON quick_replies (workspace_id, lower(shortcut));
CREATE TRIGGER trg_quick_replies_updated_at
    BEFORE UPDATE ON quick_replies
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- message_templates -------------------------------------------------------
-- Approved, structured message bodies. `external_id` holds Meta's template
-- id once approved upstream. Buttons/header are stored as JSONB so the
-- schema doesn't need to track every Meta-side combination.
CREATE TABLE message_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID                NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name              TEXT                NOT NULL,
    category          template_category   NOT NULL DEFAULT 'utility',
    status            template_status     NOT NULL DEFAULT 'draft',
    language          TEXT                NOT NULL DEFAULT 'id',
    header_kind       TEXT,
    header_content    TEXT,
    body              TEXT                NOT NULL,
    footer            TEXT,
    buttons           JSONB               NOT NULL DEFAULT '[]'::jsonb,
    external_id       TEXT,
    submitted_at      TIMESTAMPTZ,
    approved_at       TIMESTAMPTZ,
    rejection_reason  TEXT,
    created_by        UUID                REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ         NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_message_templates_unique_name
    ON message_templates (workspace_id, lower(name), language);
CREATE INDEX idx_message_templates_workspace_status
    ON message_templates (workspace_id, status, updated_at DESC);
CREATE TRIGGER trg_message_templates_updated_at
    BEFORE UPDATE ON message_templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- template_variables ------------------------------------------------------
-- One row per `{{variable}}` placeholder. Per-row storage keeps the
-- editor schema clean and lets us index lookups across templates later.
CREATE TABLE template_variables (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id   UUID         NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    name          TEXT         NOT NULL,
    label         TEXT,
    sample_value  TEXT,
    position      INT          NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness on (template_id, name) — Postgres requires an
-- expression index rather than an inline UNIQUE constraint when using lower().
CREATE UNIQUE INDEX uniq_template_variables_name
    ON template_variables (template_id, lower(name));
CREATE INDEX idx_template_variables_template ON template_variables (template_id, position);

-- --- interactive_messages ----------------------------------------------------
-- Reusable interactive payloads: reply-button menus, list selectors, and
-- media carousels. Kind discriminates the JSON shape.
CREATE TABLE interactive_messages (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT         NOT NULL,
    kind          TEXT         NOT NULL,
    payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_interactive_messages_workspace ON interactive_messages (workspace_id, kind);
CREATE TRIGGER trg_interactive_messages_updated_at
    BEFORE UPDATE ON interactive_messages
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- template_usage_logs -----------------------------------------------------
-- One row each time an agent renders a template into a composer. Helps
-- compute "most-used template" metrics later on.
CREATE TABLE template_usage_logs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id      UUID         NOT NULL REFERENCES message_templates(id) ON DELETE CASCADE,
    workspace_id     UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    conversation_id  UUID         REFERENCES conversations(id) ON DELETE SET NULL,
    used_by          UUID         REFERENCES users(id) ON DELETE SET NULL,
    variables        JSONB        NOT NULL DEFAULT '{}'::jsonb,
    rendered_body    TEXT,
    used_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_template_usage_logs_template_used
    ON template_usage_logs (template_id, used_at DESC);
CREATE INDEX idx_template_usage_logs_workspace_used
    ON template_usage_logs (workspace_id, used_at DESC);

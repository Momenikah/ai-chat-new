-- =============================================================================
-- AI Chat — Part 4: CRM contact management
-- Extends `contacts` with profile fields, adds segments + segment_rules and a
-- contact-activities timeline.
-- =============================================================================

-- --- contacts: profile fields ------------------------------------------------
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company  TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS birthday DATE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS notes    TEXT;

-- Useful indexes for filter + duplicate detection.
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_phone
    ON contacts (workspace_id, phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_workspace_email
    ON contacts (workspace_id, lower(email)) WHERE email IS NOT NULL;

-- --- segments ----------------------------------------------------------------
CREATE TABLE segments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT         NOT NULL,
    description   TEXT,
    color         TEXT         NOT NULL DEFAULT '#71717a',
    created_by    UUID         REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_segments_workspace_id ON segments (workspace_id);
CREATE TRIGGER trg_segments_updated_at
    BEFORE UPDATE ON segments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- segment_rules -----------------------------------------------------------
-- Each rule is a (field, operator, value) triple; rules within a segment are
-- AND-combined. Whitelisted fields & operators are enforced in the service.
CREATE TABLE segment_rules (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id  UUID         NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    field       TEXT         NOT NULL,
    operator    TEXT         NOT NULL,
    value       TEXT         NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_segment_rules_segment_id ON segment_rules (segment_id);

-- --- contact_activities ------------------------------------------------------
-- Timeline events. Messages and notes are pulled from their own tables; this
-- table carries semantic CRM events (contact_created, merged, imported, …).
CREATE TABLE contact_activities (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id    UUID         NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_id      UUID         REFERENCES users(id) ON DELETE SET NULL,
    kind          TEXT         NOT NULL,
    body          TEXT,
    metadata      JSONB        NOT NULL DEFAULT '{}'::jsonb,
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_contact_activities_contact_occurred
    ON contact_activities (contact_id, occurred_at DESC);
CREATE INDEX idx_contact_activities_workspace ON contact_activities (workspace_id);

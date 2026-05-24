-- =============================================================================
-- AI Chat — Part 12: Super Admin dashboard
--
-- SUPER_ADMIN is a PLATFORM-level role (a flag on the user), distinct from
-- the per-workspace MemberRole (OWNER/ADMIN/AGENT/VIEWER). Workspaces gain a
-- suspension flag enforced by the workspace middleware. Three new tables back
-- the admin audit trail, abuse reports, and the system/error log viewer.
-- =============================================================================

-- Platform super-admin flag.
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Workspace suspension (set by an admin; blocks all workspace access).
ALTER TABLE workspaces
    ADD COLUMN IF NOT EXISTS suspended_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS suspension_reason TEXT;

CREATE TYPE abuse_status AS ENUM ('open', 'reviewing', 'resolved', 'dismissed');
CREATE TYPE system_log_level AS ENUM ('debug', 'info', 'warn', 'error');

-- --- admin_audit_logs -------------------------------------------------------
-- Every super-admin mutation is recorded here (suspend, impersonate, change
-- subscription, resolve report, ...). target_type/target_id identify the
-- affected entity; metadata holds action-specific detail.
CREATE TABLE admin_audit_logs (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id  UUID         REFERENCES users(id) ON DELETE SET NULL,
    actor_email    TEXT         NOT NULL DEFAULT '',
    action         TEXT         NOT NULL,
    target_type    TEXT         NOT NULL DEFAULT '',
    target_id      TEXT         NOT NULL DEFAULT '',
    metadata       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    ip             TEXT,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_admin_audit_logs_created ON admin_audit_logs (created_at DESC);
CREATE INDEX idx_admin_audit_logs_actor ON admin_audit_logs (actor_user_id, created_at DESC);

-- --- abuse_reports ----------------------------------------------------------
CREATE TABLE abuse_reports (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID         REFERENCES workspaces(id) ON DELETE SET NULL,
    reporter_user_id UUID         REFERENCES users(id) ON DELETE SET NULL,
    reporter_email   TEXT,
    category         TEXT         NOT NULL DEFAULT 'other',  -- spam | phishing | scam | other
    description      TEXT         NOT NULL DEFAULT '',
    status           abuse_status NOT NULL DEFAULT 'open',
    resolution_note  TEXT,
    resolved_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    resolved_at      TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_abuse_reports_status ON abuse_reports (status, created_at DESC);
CREATE INDEX idx_abuse_reports_workspace ON abuse_reports (workspace_id, created_at DESC);
CREATE TRIGGER trg_abuse_reports_updated_at
    BEFORE UPDATE ON abuse_reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- system_logs ------------------------------------------------------------
-- Application/system events surfaced in the admin "error log" viewer. The
-- HTTP error handler records 5xx responses here; other code can log freely.
CREATE TABLE system_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level         system_log_level NOT NULL DEFAULT 'info',
    source        TEXT             NOT NULL DEFAULT '',
    message       TEXT             NOT NULL,
    context       JSONB            NOT NULL DEFAULT '{}'::jsonb,
    workspace_id  UUID             REFERENCES workspaces(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ      NOT NULL DEFAULT now()
);
CREATE INDEX idx_system_logs_created ON system_logs (created_at DESC);
CREATE INDEX idx_system_logs_level ON system_logs (level, created_at DESC);

-- Seed example abuse reports so the dashboard isn't empty on a fresh install.
-- (Best-effort: attaches to the demo workspace if present.)
INSERT INTO abuse_reports (workspace_id, reporter_email, category, description, status)
SELECT w.id, 'system@aichat.id', 'spam',
       'Contoh laporan: pengiriman broadcast berlebihan terdeteksi.', 'open'
FROM workspaces w
ORDER BY w.created_at ASC
LIMIT 1;

-- =============================================================================
-- AI Chat — Part 2: workspaces, team members, invitations, channels
--
-- Part 1 modelled a single `organizations` table with `users.organization_id`
-- and `users.role`. Part 2 generalises this: a user can belong to many
-- workspaces, each with its own role. The role therefore moves onto
-- `workspace_members`.
-- =============================================================================

-- --- Enums -------------------------------------------------------------------
CREATE TYPE member_role       AS ENUM ('OWNER', 'ADMIN', 'AGENT', 'VIEWER');
CREATE TYPE member_status     AS ENUM ('active', 'invited', 'suspended');
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'revoked', 'expired');
CREATE TYPE channel_type      AS ENUM ('whatsapp', 'instagram', 'messenger');
CREATE TYPE channel_status    AS ENUM ('disconnected', 'pending', 'connected', 'error');

-- --- organizations -> workspaces ---------------------------------------------
ALTER TABLE organizations RENAME TO workspaces;
ALTER TRIGGER trg_organizations_updated_at ON workspaces
    RENAME TO trg_workspaces_updated_at;

ALTER TABLE workspaces ADD COLUMN logo_url    TEXT;
ALTER TABLE workspaces ADD COLUMN brand_color TEXT NOT NULL DEFAULT '#18181b';
ALTER TABLE workspaces ADD COLUMN timezone    TEXT NOT NULL DEFAULT 'Asia/Jakarta';
ALTER TABLE workspaces ADD COLUMN owner_id    UUID REFERENCES users(id) ON DELETE SET NULL;

-- --- workspace_members -------------------------------------------------------
CREATE TABLE workspace_members (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID          NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role          member_role   NOT NULL DEFAULT 'AGENT',
    status        member_status NOT NULL DEFAULT 'active',
    invited_by    UUID          REFERENCES users(id) ON DELETE SET NULL,
    joined_at     TIMESTAMPTZ,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, user_id)
);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_user_id      ON workspace_members (user_id);
CREATE TRIGGER trg_workspace_members_updated_at
    BEFORE UPDATE ON workspace_members
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Migrate Part 1 users into the new membership model.
INSERT INTO workspace_members (workspace_id, user_id, role, status, joined_at)
SELECT
    u.organization_id,
    u.id,
    (CASE WHEN u.role::text = 'SUPER_ADMIN' THEN 'OWNER' ELSE u.role::text END)::member_role,
    'active',
    now()
FROM users u
WHERE u.organization_id IS NOT NULL;

-- Point each workspace at its OWNER.
UPDATE workspaces w
SET owner_id = m.user_id
FROM workspace_members m
WHERE m.workspace_id = w.id AND m.role = 'OWNER';

-- The role/tenant now lives on workspace_members; drop the legacy columns.
ALTER TABLE users DROP COLUMN IF EXISTS role;
ALTER TABLE users DROP COLUMN IF EXISTS organization_id;
DROP TYPE IF EXISTS user_role;

-- --- workspace_invitations ---------------------------------------------------
CREATE TABLE workspace_invitations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID              NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email         TEXT              NOT NULL,
    role          member_role       NOT NULL DEFAULT 'AGENT',
    token         TEXT              NOT NULL UNIQUE,
    status        invitation_status NOT NULL DEFAULT 'pending',
    invited_by    UUID              REFERENCES users(id) ON DELETE SET NULL,
    expires_at    TIMESTAMPTZ       NOT NULL,
    accepted_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations (workspace_id);
-- Only one pending invitation per email per workspace.
CREATE UNIQUE INDEX idx_workspace_invitations_pending
    ON workspace_invitations (workspace_id, lower(email))
    WHERE status = 'pending';
CREATE TRIGGER trg_workspace_invitations_updated_at
    BEFORE UPDATE ON workspace_invitations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- channels ----------------------------------------------------------------
CREATE TABLE channels (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id       UUID           NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    type               channel_type   NOT NULL,
    name               TEXT           NOT NULL,
    status             channel_status NOT NULL DEFAULT 'disconnected',
    external_id        TEXT,
    error_message      TEXT,
    last_connected_at  TIMESTAMPTZ,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX idx_channels_workspace_id ON channels (workspace_id);
CREATE TRIGGER trg_channels_updated_at
    BEFORE UPDATE ON channels
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- channel_credentials -----------------------------------------------------
-- Credentials are AES-256-GCM encrypted; only ciphertext + nonce are stored.
CREATE TABLE channel_credentials (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel_id  UUID        NOT NULL UNIQUE REFERENCES channels(id) ON DELETE CASCADE,
    ciphertext  BYTEA       NOT NULL,
    nonce       BYTEA       NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_channel_credentials_updated_at
    BEFORE UPDATE ON channel_credentials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- upload_files ------------------------------------------------------------
CREATE TABLE upload_files (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id   UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    uploaded_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
    kind           TEXT        NOT NULL DEFAULT 'media',
    original_name  TEXT        NOT NULL,
    stored_path    TEXT        NOT NULL,
    mime_type      TEXT        NOT NULL,
    size_bytes     BIGINT      NOT NULL DEFAULT 0,
    url            TEXT        NOT NULL,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_upload_files_workspace_id ON upload_files (workspace_id);

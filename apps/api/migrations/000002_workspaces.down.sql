-- =============================================================================
-- AI Chat — rollback Part 2
-- =============================================================================

DROP TABLE IF EXISTS upload_files;
DROP TABLE IF EXISTS channel_credentials;
DROP TABLE IF EXISTS channels;
DROP TABLE IF EXISTS workspace_invitations;

-- Restore the Part 1 columns on users before dropping workspace_members.
CREATE TYPE user_role AS ENUM ('SUPER_ADMIN', 'OWNER', 'ADMIN', 'AGENT', 'VIEWER');

ALTER TABLE users ADD COLUMN organization_id UUID;
ALTER TABLE users ADD COLUMN role user_role NOT NULL DEFAULT 'AGENT';

UPDATE users u
SET organization_id = m.workspace_id,
    role            = m.role::text::user_role
FROM workspace_members m
WHERE m.user_id = u.id;

DROP TABLE IF EXISTS workspace_members;

ALTER TABLE workspaces DROP COLUMN IF EXISTS owner_id;
ALTER TABLE workspaces DROP COLUMN IF EXISTS timezone;
ALTER TABLE workspaces DROP COLUMN IF EXISTS brand_color;
ALTER TABLE workspaces DROP COLUMN IF EXISTS logo_url;

ALTER TRIGGER trg_workspaces_updated_at ON workspaces
    RENAME TO trg_organizations_updated_at;
ALTER TABLE workspaces RENAME TO organizations;

ALTER TABLE users
    ADD CONSTRAINT users_organization_id_fkey
    FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;

DROP TYPE IF EXISTS channel_status;
DROP TYPE IF EXISTS channel_type;
DROP TYPE IF EXISTS invitation_status;
DROP TYPE IF EXISTS member_status;
DROP TYPE IF EXISTS member_role;

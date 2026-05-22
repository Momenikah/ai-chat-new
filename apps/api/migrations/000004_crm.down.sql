-- =============================================================================
-- AI Chat — rollback Part 4
-- =============================================================================

DROP TABLE IF EXISTS contact_activities;
DROP TABLE IF EXISTS segment_rules;
DROP TABLE IF EXISTS segments;

DROP INDEX IF EXISTS idx_contacts_workspace_email;
DROP INDEX IF EXISTS idx_contacts_workspace_phone;

ALTER TABLE contacts DROP COLUMN IF EXISTS notes;
ALTER TABLE contacts DROP COLUMN IF EXISTS birthday;
ALTER TABLE contacts DROP COLUMN IF EXISTS company;
ALTER TABLE contacts DROP COLUMN IF EXISTS location;

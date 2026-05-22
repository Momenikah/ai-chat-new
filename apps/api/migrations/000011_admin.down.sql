DROP TABLE IF EXISTS system_logs;
DROP TABLE IF EXISTS abuse_reports;
DROP TABLE IF EXISTS admin_audit_logs;
DROP TYPE IF EXISTS system_log_level;
DROP TYPE IF EXISTS abuse_status;
ALTER TABLE workspaces DROP COLUMN IF EXISTS suspension_reason;
ALTER TABLE workspaces DROP COLUMN IF EXISTS suspended_at;
ALTER TABLE users DROP COLUMN IF EXISTS is_super_admin;

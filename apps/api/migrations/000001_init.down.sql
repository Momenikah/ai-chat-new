-- =============================================================================
-- AI Chat — rollback initial schema (Part 1)
-- =============================================================================

DROP TABLE IF EXISTS refresh_tokens;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS organizations;

DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS user_role;

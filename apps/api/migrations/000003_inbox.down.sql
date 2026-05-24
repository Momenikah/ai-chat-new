-- =============================================================================
-- AI Chat — rollback Part 3
-- =============================================================================

DROP TABLE IF EXISTS agent_presence;
DROP TABLE IF EXISTS contact_tags;
DROP TABLE IF EXISTS tags;
DROP TABLE IF EXISTS internal_notes;
DROP TABLE IF EXISTS conversation_assignments;
DROP TABLE IF EXISTS message_attachments;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS conversations;
DROP TABLE IF EXISTS contacts;

DROP TYPE IF EXISTS message_kind;
DROP TYPE IF EXISTS message_status;
DROP TYPE IF EXISTS message_direction;
DROP TYPE IF EXISTS conversation_status;

-- =============================================================================
-- AI Chat — rollback Part 5
-- =============================================================================

DROP INDEX IF EXISTS idx_channels_type_external;
DROP INDEX IF EXISTS idx_messages_external_id;
DROP TABLE IF EXISTS webhook_logs;

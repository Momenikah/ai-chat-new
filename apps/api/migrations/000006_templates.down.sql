-- =============================================================================
-- AI Chat — rollback Part 7
-- =============================================================================

DROP TABLE IF EXISTS template_usage_logs;
DROP TABLE IF EXISTS interactive_messages;
DROP TABLE IF EXISTS template_variables;
DROP TABLE IF EXISTS message_templates;
DROP TABLE IF EXISTS quick_replies;

DROP TYPE IF EXISTS template_status;
DROP TYPE IF EXISTS template_category;

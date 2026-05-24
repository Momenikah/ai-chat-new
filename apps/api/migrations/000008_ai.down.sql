ALTER TABLE conversations DROP COLUMN IF EXISTS ai_disabled;

DROP TABLE IF EXISTS ai_prompt_reviews;
DROP TABLE IF EXISTS bot_reply_logs;
DROP TABLE IF EXISTS knowledge_chunks;
DROP TABLE IF EXISTS knowledge_documents;
DROP TABLE IF EXISTS ai_agents;

DROP TYPE IF EXISTS prompt_review_status;
DROP TYPE IF EXISTS knowledge_status;
DROP TYPE IF EXISTS knowledge_source;

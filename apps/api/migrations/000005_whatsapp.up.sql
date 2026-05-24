-- =============================================================================
-- AI Chat — Part 5: WhatsApp Cloud API integration
-- Adds the webhook_logs table for inbound webhook auditing and a small set
-- of indexes that the WhatsApp dispatcher relies on.
-- =============================================================================

-- --- webhook_logs ------------------------------------------------------------
-- Slim audit log. We deliberately do NOT store full message bodies here —
-- those live in the `messages` table once parsed. Logs only carry envelope
-- metadata + the truncated raw payload for debugging.
CREATE TABLE webhook_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id    UUID         REFERENCES channels(id) ON DELETE SET NULL,
    provider      TEXT         NOT NULL,
    direction     TEXT         NOT NULL DEFAULT 'incoming',
    event_type    TEXT,
    status_code   INT          NOT NULL DEFAULT 200,
    payload       JSONB        NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    received_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_logs_channel_received
    ON webhook_logs (channel_id, received_at DESC);
CREATE INDEX idx_webhook_logs_provider_received
    ON webhook_logs (provider, received_at DESC);

-- --- messages: lookup by provider id -----------------------------------------
-- Used by the status callback (Meta sends `id` of the original message).
CREATE INDEX IF NOT EXISTS idx_messages_external_id
    ON messages (external_id) WHERE external_id IS NOT NULL;

-- --- channels: lookup by phone_number_id (stored in external_id) -------------
CREATE INDEX IF NOT EXISTS idx_channels_type_external
    ON channels (type, external_id) WHERE external_id IS NOT NULL;

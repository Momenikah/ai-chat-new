-- =============================================================================
-- AI Chat — Part 8: broadcast campaigns
-- Campaigns explode into per-recipient rows that the worker drains from a
-- Redis queue. broadcast_logs is the event-by-event audit; message_queue
-- is the durable outbox so jobs can be recovered after Redis loss.
-- =============================================================================

CREATE TYPE broadcast_status  AS ENUM ('draft','scheduled','sending','completed','failed','cancelled');
CREATE TYPE recipient_status  AS ENUM ('queued','sent','delivered','read','failed','skipped');

-- --- broadcast_campaigns -----------------------------------------------------
CREATE TABLE broadcast_campaigns (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id      UUID              NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    channel_id        UUID              NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    template_id       UUID              REFERENCES message_templates(id) ON DELETE SET NULL,
    name              TEXT              NOT NULL,
    audience_kind     TEXT              NOT NULL,
    audience_filter   JSONB             NOT NULL DEFAULT '{}'::jsonb,
    body_override     TEXT,
    variables         JSONB             NOT NULL DEFAULT '{}'::jsonb,
    status            broadcast_status  NOT NULL DEFAULT 'draft',
    rate_per_minute   INT               NOT NULL DEFAULT 60,
    scheduled_at      TIMESTAMPTZ,
    started_at        TIMESTAMPTZ,
    completed_at      TIMESTAMPTZ,
    total_recipients  INT               NOT NULL DEFAULT 0,
    sent_count        INT               NOT NULL DEFAULT 0,
    delivered_count   INT               NOT NULL DEFAULT 0,
    read_count        INT               NOT NULL DEFAULT 0,
    failed_count      INT               NOT NULL DEFAULT 0,
    reply_count       INT               NOT NULL DEFAULT 0,
    created_by        UUID              REFERENCES users(id) ON DELETE SET NULL,
    created_at        TIMESTAMPTZ       NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_campaigns_workspace
    ON broadcast_campaigns (workspace_id, status, created_at DESC);
CREATE INDEX idx_broadcast_campaigns_scheduled
    ON broadcast_campaigns (scheduled_at) WHERE status = 'scheduled';
CREATE TRIGGER trg_broadcast_campaigns_updated_at
    BEFORE UPDATE ON broadcast_campaigns
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- broadcast_recipients ----------------------------------------------------
-- One row per intended send. Per-row variables are pre-merged at launch
-- time so the worker has a self-contained job.
CREATE TABLE broadcast_recipients (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id          UUID              NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    workspace_id         UUID              NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    contact_id           UUID              REFERENCES contacts(id) ON DELETE SET NULL,
    name                 TEXT,
    phone                TEXT,
    external_id          TEXT,
    variables            JSONB             NOT NULL DEFAULT '{}'::jsonb,
    rendered_body        TEXT,
    status               recipient_status  NOT NULL DEFAULT 'queued',
    message_id           UUID              REFERENCES messages(id) ON DELETE SET NULL,
    external_message_id  TEXT,
    attempts             INT               NOT NULL DEFAULT 0,
    last_error           TEXT,
    enqueued_at          TIMESTAMPTZ,
    sent_at              TIMESTAMPTZ,
    delivered_at         TIMESTAMPTZ,
    read_at              TIMESTAMPTZ,
    failed_at            TIMESTAMPTZ,
    created_at           TIMESTAMPTZ       NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_recipients_campaign_status
    ON broadcast_recipients (campaign_id, status);
CREATE INDEX idx_broadcast_recipients_external_id
    ON broadcast_recipients (external_message_id) WHERE external_message_id IS NOT NULL;

-- --- broadcast_logs ----------------------------------------------------------
CREATE TABLE broadcast_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id   UUID         NOT NULL REFERENCES broadcast_campaigns(id) ON DELETE CASCADE,
    recipient_id  UUID         REFERENCES broadcast_recipients(id) ON DELETE CASCADE,
    event         TEXT         NOT NULL,
    detail        TEXT,
    occurred_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_broadcast_logs_campaign
    ON broadcast_logs (campaign_id, occurred_at DESC);
CREATE INDEX idx_broadcast_logs_recipient
    ON broadcast_logs (recipient_id, occurred_at DESC);

-- --- message_queue (outbox) --------------------------------------------------
-- Durable copy of every job pushed to Redis. The worker can rehydrate
-- queued/processing rows on startup if Redis was flushed.
CREATE TABLE message_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    kind            TEXT         NOT NULL,
    payload         JSONB        NOT NULL,
    status          TEXT         NOT NULL DEFAULT 'queued',
    attempts        INT          NOT NULL DEFAULT 0,
    scheduled_at    TIMESTAMPTZ,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_message_queue_status_scheduled
    ON message_queue (status, scheduled_at);
CREATE INDEX idx_message_queue_workspace
    ON message_queue (workspace_id, created_at DESC);

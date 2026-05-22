-- =============================================================================
-- AI Chat — Part 10: Developer API, Webhooks, n8n Integration
--
-- API keys are NEVER stored in plaintext: we store only the SHA-256 hash
-- (so the DB is useless for forging keys) plus a short prefix for display
-- in the dashboard. The plaintext key is shown to the operator exactly
-- once when it is minted.
--
-- Webhook secrets ARE stored in plaintext on purpose — the operator must
-- be able to view them to configure the receiving end (n8n, custom code,
-- etc.). They are scoped to a single endpoint row and can be rotated at
-- any time.
-- =============================================================================

-- --- api_keys ---------------------------------------------------------------
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            TEXT         NOT NULL,
    prefix          TEXT         NOT NULL,
    key_hash        TEXT         NOT NULL UNIQUE,
    scopes          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    last_used_at    TIMESTAMPTZ,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_keys_workspace ON api_keys (workspace_id, created_at DESC);
CREATE INDEX idx_api_keys_hash_active
    ON api_keys (key_hash)
    WHERE revoked_at IS NULL;
CREATE TRIGGER trg_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- api_usage_logs ---------------------------------------------------------
-- One row per public API request. Keep an index on workspace + recency
-- so the dashboard can show recent activity fast.
CREATE TABLE api_usage_logs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    api_key_id      UUID         REFERENCES api_keys(id) ON DELETE SET NULL,
    method          TEXT         NOT NULL,
    path            TEXT         NOT NULL,
    status_code     INT          NOT NULL,
    latency_ms      INT          NOT NULL DEFAULT 0,
    ip              TEXT,
    user_agent      TEXT,
    error_message   TEXT,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_api_usage_workspace ON api_usage_logs (workspace_id, created_at DESC);
CREATE INDEX idx_api_usage_key ON api_usage_logs (api_key_id, created_at DESC);

-- --- webhook_endpoints ------------------------------------------------------
-- An endpoint can subscribe to multiple events (TEXT[]). The HMAC secret
-- is signed against the raw request body using sha256 on every delivery.
CREATE TABLE webhook_endpoints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id    UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name            TEXT         NOT NULL,
    url             TEXT         NOT NULL,
    secret          TEXT         NOT NULL,
    events          TEXT[]       NOT NULL DEFAULT ARRAY[]::TEXT[],
    enabled         BOOLEAN      NOT NULL DEFAULT TRUE,
    headers         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    created_by      UUID         REFERENCES users(id) ON DELETE SET NULL,
    last_delivery_at TIMESTAMPTZ,
    last_status     INT,
    failure_count   INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_endpoints_workspace ON webhook_endpoints (workspace_id, created_at DESC);
CREATE INDEX idx_webhook_endpoints_events ON webhook_endpoints USING GIN (events);
CREATE TRIGGER trg_webhook_endpoints_updated_at
    BEFORE UPDATE ON webhook_endpoints
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- webhook_delivery_logs --------------------------------------------------
-- One row per delivery attempt (so a single event with 3 retries yields 3
-- rows). Useful for the operator dashboard + for debugging integrations.
CREATE TABLE webhook_delivery_logs (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id         UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    webhook_endpoint_id  UUID         NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
    event                TEXT         NOT NULL,
    payload              JSONB        NOT NULL DEFAULT '{}'::jsonb,
    status_code          INT,
    attempt              INT          NOT NULL DEFAULT 1,
    succeeded            BOOLEAN      NOT NULL DEFAULT FALSE,
    response_body        TEXT,
    error_message        TEXT,
    duration_ms          INT          NOT NULL DEFAULT 0,
    created_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_delivery_endpoint
    ON webhook_delivery_logs (webhook_endpoint_id, created_at DESC);
CREATE INDEX idx_webhook_delivery_workspace
    ON webhook_delivery_logs (workspace_id, created_at DESC);

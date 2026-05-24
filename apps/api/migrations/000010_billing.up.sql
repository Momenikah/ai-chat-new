-- =============================================================================
-- AI Chat — Part 11: Billing SaaS, pricing, plan limits
--
-- Plans are reference data seeded at the bottom of this migration (idempotent
-- upsert on `code`). Limits live in a JSONB column so a plan's entitlements
-- can be tuned without a schema change; -1 means "unlimited" for numeric
-- limits, and boolean features gate whole capabilities (API, n8n, AI).
--
-- Subscriptions are one-per-workspace. A workspace without a row is treated
-- as FREE/active by the application (lazy creation on first billing access).
-- =============================================================================

CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled');
CREATE TYPE invoice_status AS ENUM ('draft', 'open', 'paid', 'void');

-- --- saas_plans -------------------------------------------------------------
CREATE TABLE saas_plans (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            TEXT         NOT NULL UNIQUE,           -- FREE | BASIC | LITE
    name            TEXT         NOT NULL,
    description     TEXT         NOT NULL DEFAULT '',
    price_idr       BIGINT       NOT NULL DEFAULT 0,        -- monthly price in IDR
    billing_period  TEXT         NOT NULL DEFAULT 'monthly',-- monthly | forever
    features        JSONB        NOT NULL DEFAULT '[]'::jsonb,   -- string[] for the pricing page
    limits          JSONB        NOT NULL DEFAULT '{}'::jsonb,   -- entitlements (see below)
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order      INT          NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_saas_plans_updated_at
    BEFORE UPDATE ON saas_plans
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- saas_subscriptions -----------------------------------------------------
CREATE TABLE saas_subscriptions (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id          UUID                NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id               UUID                NOT NULL REFERENCES saas_plans(id),
    status                subscription_status NOT NULL DEFAULT 'active',
    trial_ends_at         TIMESTAMPTZ,
    current_period_start  TIMESTAMPTZ         NOT NULL DEFAULT now(),
    current_period_end    TIMESTAMPTZ,
    cancel_at_period_end  BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at            TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at            TIMESTAMPTZ         NOT NULL DEFAULT now()
);
CREATE INDEX idx_saas_subscriptions_plan ON saas_subscriptions (plan_id);
CREATE TRIGGER trg_saas_subscriptions_updated_at
    BEFORE UPDATE ON saas_subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- usage_records ----------------------------------------------------------
-- Daily snapshots of metered usage per workspace. The usage endpoint upserts
-- today's row per metric so the dashboard can show current usage + a short
-- trend without a separate metering job.
CREATE TABLE usage_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    metric        TEXT         NOT NULL,    -- team_members | knowledge_documents | whatsapp_numbers | messages | api_calls
    value         BIGINT       NOT NULL DEFAULT 0,
    recorded_on   DATE         NOT NULL DEFAULT CURRENT_DATE,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    UNIQUE (workspace_id, metric, recorded_on)
);
CREATE INDEX idx_usage_records_workspace ON usage_records (workspace_id, recorded_on DESC);
CREATE TRIGGER trg_usage_records_updated_at
    BEFORE UPDATE ON usage_records
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- --- invoices ---------------------------------------------------------------
-- Placeholder invoices generated when a workspace changes to a paid plan.
-- payment_provider/payment_ref hold the (placeholder) Midtrans references.
CREATE TABLE invoices (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id     UUID            NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    subscription_id  UUID            REFERENCES saas_subscriptions(id) ON DELETE SET NULL,
    number           TEXT            NOT NULL UNIQUE,
    amount_idr       BIGINT          NOT NULL DEFAULT 0,
    status           invoice_status  NOT NULL DEFAULT 'open',
    period_start     TIMESTAMPTZ,
    period_end       TIMESTAMPTZ,
    paid_at          TIMESTAMPTZ,
    payment_provider TEXT,
    payment_ref      TEXT,
    created_at       TIMESTAMPTZ     NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ     NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoices_workspace ON invoices (workspace_id, created_at DESC);
CREATE TRIGGER trg_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- Seed the three pricing plans. Idempotent: re-running updates the catalog.
-- Numeric limits: -1 = unlimited, 0 = feature off. Adjust freely here.
-- =============================================================================
INSERT INTO saas_plans (code, name, description, price_idr, billing_period, sort_order, features, limits)
VALUES
  (
    'FREE', 'Free', 'Mulai gratis selamanya.', 0, 'forever', 1,
    '["Connect WhatsApp, Instagram, Messenger","Unlimited Message","Akses Inbox","Quick Reply"]'::jsonb,
    '{"team_members":2,"knowledge_documents":0,"whatsapp_numbers":1,"message_history_days":7,"api_access":false,"n8n_integration":false,"ai_chatbot":false}'::jsonb
  ),
  (
    'BASIC', 'Basic', 'Untuk bisnis yang mulai berkembang.', 25000, 'monthly', 2,
    '["Semua fitur FREE","n8n Integration","API Access","30-day message history","1 WhatsApp Number"]'::jsonb,
    '{"team_members":3,"knowledge_documents":0,"whatsapp_numbers":1,"message_history_days":30,"api_access":true,"n8n_integration":true,"ai_chatbot":false}'::jsonb
  ),
  (
    'LITE', 'Lite', 'Untuk tim yang butuh AI + kolaborasi.', 49000, 'monthly', 3,
    '["Semua fitur BASIC","AI Chatbot","5 Knowledge Documents","5 Team Members","90-day message history","Media Library","1 WhatsApp Number"]'::jsonb,
    '{"team_members":5,"knowledge_documents":5,"whatsapp_numbers":1,"message_history_days":90,"api_access":true,"n8n_integration":true,"ai_chatbot":true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE
SET name           = EXCLUDED.name,
    description    = EXCLUDED.description,
    price_idr      = EXCLUDED.price_idr,
    billing_period = EXCLUDED.billing_period,
    sort_order     = EXCLUDED.sort_order,
    features       = EXCLUDED.features,
    limits         = EXCLUDED.limits,
    updated_at     = now();

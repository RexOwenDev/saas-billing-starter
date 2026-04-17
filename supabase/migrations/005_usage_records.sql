-- ============================================================
-- 005_usage_records.sql
-- Usage event tracking for metered billing.
-- Each row is one billable event. Aggregated per billing period
-- and reported to Stripe via usage records API.
-- ============================================================

CREATE TABLE IF NOT EXISTS usage_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  -- What was consumed
  feature         TEXT NOT NULL, -- e.g. 'api_calls', 'storage_gb', 'seats'
  quantity        INTEGER NOT NULL DEFAULT 1,
  -- When it happened
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Idempotency: caller supplies an idempotency_key to prevent double-counting
  idempotency_key TEXT,
  -- Stripe usage record ID after reporting (null until reported)
  stripe_usage_record_id TEXT,
  reported_at     TIMESTAMPTZ,
  -- Billing period this event falls into
  billing_period_start  TIMESTAMPTZ NOT NULL,
  billing_period_end    TIMESTAMPTZ NOT NULL,
  metadata        JSONB NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Prevent double-counting the same event
CREATE UNIQUE INDEX usage_records_idempotency_key_idx
  ON usage_records(org_id, feature, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Fast period aggregation query
CREATE INDEX usage_records_period_idx
  ON usage_records(org_id, feature, billing_period_start, billing_period_end);

CREATE INDEX usage_records_subscription_idx ON usage_records(subscription_id);
CREATE INDEX usage_records_unreported_idx ON usage_records(reported_at) WHERE reported_at IS NULL;

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE usage_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their usage"
  ON usage_records FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Application inserts usage records (via service role or authenticated route)
CREATE POLICY "Org members can insert usage records"
  ON usage_records FOR INSERT
  WITH CHECK (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

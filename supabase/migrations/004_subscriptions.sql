-- ============================================================
-- 004_subscriptions.sql
-- Subscription state tracking — the core billing table.
-- Status is kept in sync with Stripe via webhook events.
-- One active subscription per org at a time (enforced by idx).
-- ============================================================

-- Valid Stripe subscription statuses
-- https://docs.stripe.com/api/subscriptions/object#subscription_object-status
CREATE TYPE subscription_status AS ENUM (
  'incomplete',
  'incomplete_expired',
  'trialing',
  'active',
  'past_due',
  'canceled',
  'unpaid',
  'paused'
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                          TEXT PRIMARY KEY, -- Stripe subscription ID (sub_...)
  org_id                      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id                 TEXT NOT NULL REFERENCES customers(stripe_customer_id),
  status                      subscription_status NOT NULL DEFAULT 'incomplete',
  price_id                    TEXT NOT NULL REFERENCES prices(id),
  product_id                  TEXT NOT NULL REFERENCES products(id),
  -- Quantities and amounts
  quantity                    INTEGER NOT NULL DEFAULT 1,
  -- Trial dates
  trial_start                 TIMESTAMPTZ,
  trial_end                   TIMESTAMPTZ,
  -- Billing period
  current_period_start        TIMESTAMPTZ NOT NULL,
  current_period_end          TIMESTAMPTZ NOT NULL,
  -- Cancellation
  cancel_at_period_end        BOOLEAN NOT NULL DEFAULT false,
  canceled_at                 TIMESTAMPTZ,
  cancel_at                   TIMESTAMPTZ,
  -- Timestamps
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at                    TIMESTAMPTZ,
  -- Latest invoice for display
  latest_invoice_id           TEXT,
  -- Raw Stripe metadata for anything not captured above
  metadata                    JSONB NOT NULL DEFAULT '{}'
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Only one non-canceled subscription per org
CREATE UNIQUE INDEX one_active_subscription_per_org
  ON subscriptions(org_id)
  WHERE status NOT IN ('canceled', 'incomplete_expired');

CREATE INDEX subscriptions_org_id_idx ON subscriptions(org_id);
CREATE INDEX subscriptions_customer_id_idx ON subscriptions(customer_id);
CREATE INDEX subscriptions_status_idx ON subscriptions(status);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their subscription"
  ON subscriptions FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Only service role writes subscription state (via webhook handler)

-- ============================================================
-- 002_customers.sql
-- Stripe customer <-> organization mapping.
-- One row per org: links Stripe customer_id to our org_id.
-- Never store payment methods or PII here — Stripe owns that.
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id              UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT NOT NULL UNIQUE,
  email               TEXT NOT NULL,
  name                TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Fast lookups from Stripe webhook payloads (stripe_customer_id arrives in every event)
CREATE INDEX customers_stripe_customer_id_idx ON customers(stripe_customer_id);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Org members can read their own customer record
CREATE POLICY "Org members can read their customer"
  ON customers FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Only org owner can modify the customer record
CREATE POLICY "Org owner can manage customer"
  ON customers FOR ALL
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
    )
  );

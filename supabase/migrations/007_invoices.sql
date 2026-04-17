-- ============================================================
-- 007_invoices.sql
-- Invoice state tracking — mirrored from Stripe.
-- Updated via invoice.* webhook events.
-- ============================================================

CREATE TYPE invoice_status AS ENUM (
  'draft',
  'open',
  'paid',
  'uncollectible',
  'void'
);

CREATE TABLE IF NOT EXISTS invoices (
  id                  TEXT PRIMARY KEY, -- Stripe invoice ID (in_...)
  org_id              UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id         TEXT NOT NULL REFERENCES customers(stripe_customer_id),
  subscription_id     TEXT REFERENCES subscriptions(id),
  status              invoice_status NOT NULL DEFAULT 'draft',
  -- Amounts (in smallest currency unit — cents for USD)
  amount_due          INTEGER NOT NULL DEFAULT 0,
  amount_paid         INTEGER NOT NULL DEFAULT 0,
  amount_remaining    INTEGER NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'usd',
  -- Dates
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  due_date            TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  -- URLs
  hosted_invoice_url  TEXT, -- Stripe-hosted invoice page
  invoice_pdf         TEXT, -- Direct PDF download link
  -- Description / line items summary
  description         TEXT,
  -- Timestamps
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX invoices_org_id_idx ON invoices(org_id);
CREATE INDEX invoices_subscription_id_idx ON invoices(subscription_id);
CREATE INDEX invoices_status_idx ON invoices(status);
CREATE INDEX invoices_created_at_idx ON invoices(created_at DESC);

-- ============================================================
-- RLS
-- ============================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read their invoices"
  ON invoices FOR SELECT
  USING (
    org_id IN (
      SELECT id FROM organizations WHERE owner_id = auth.uid()
      UNION
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

-- Only service role writes invoices (via webhook handler)

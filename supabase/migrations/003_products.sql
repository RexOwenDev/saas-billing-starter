-- ============================================================
-- 003_products.sql
-- Stripe product + price catalog mirror.
-- Populated by scripts/seed-stripe-products.ts and kept in sync
-- via webhook events (product.updated, price.updated, etc.).
-- ============================================================

CREATE TABLE IF NOT EXISTS products (
  id                TEXT PRIMARY KEY, -- Stripe product ID (prod_...)
  name              TEXT NOT NULL,
  description       TEXT,
  active            BOOLEAN NOT NULL DEFAULT true,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS prices (
  id                    TEXT PRIMARY KEY, -- Stripe price ID (price_...)
  product_id            TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  active                BOOLEAN NOT NULL DEFAULT true,
  currency              TEXT NOT NULL DEFAULT 'usd',
  type                  TEXT NOT NULL CHECK (type IN ('one_time', 'recurring')),
  -- For recurring prices
  interval              TEXT CHECK (interval IN ('day', 'week', 'month', 'year')),
  interval_count        INTEGER,
  -- Amount in smallest currency unit (cents for USD)
  unit_amount           INTEGER, -- null for metered/usage-based
  -- Metered billing
  billing_scheme        TEXT NOT NULL DEFAULT 'per_unit' CHECK (billing_scheme IN ('per_unit', 'tiered')),
  usage_type            TEXT NOT NULL DEFAULT 'licensed' CHECK (usage_type IN ('licensed', 'metered')),
  aggregate_usage       TEXT CHECK (aggregate_usage IN ('sum', 'last_during_period', 'last_ever', 'max')),
  metadata              JSONB NOT NULL DEFAULT '{}',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER prices_updated_at
  BEFORE UPDATE ON prices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- RLS — products/prices are read-only for all authenticated users
-- (pricing page needs to read them; only webhooks write to them)
-- ============================================================
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE prices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated users can read active products"
  ON products FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

CREATE POLICY "All authenticated users can read active prices"
  ON prices FOR SELECT
  USING (auth.uid() IS NOT NULL AND active = true);

-- Service role (used by webhook handler) bypasses RLS entirely

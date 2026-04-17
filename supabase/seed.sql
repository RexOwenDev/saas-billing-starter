-- ============================================================
-- seed.sql
-- Demo data for local development.
-- Run after migrations: npx supabase db push && npx supabase db seed
-- ============================================================

-- Seed products (Stripe test mode IDs — replace with real IDs after seeding Stripe)
INSERT INTO products (id, name, description, active, metadata) VALUES
  ('prod_free_demo',       'Free',       'For individuals and small projects', true, '{"tier": "free"}'),
  ('prod_pro_demo',        'Pro',        'For growing teams',                  true, '{"tier": "pro"}'),
  ('prod_enterprise_demo', 'Enterprise', 'For scaling organizations',          true, '{"tier": "enterprise"}')
ON CONFLICT (id) DO NOTHING;

-- Seed prices
INSERT INTO prices (id, product_id, active, currency, type, interval, interval_count, unit_amount, billing_scheme, usage_type) VALUES
  -- Free tier (no charge)
  ('price_free_monthly_demo',            'prod_free_demo',        true, 'usd', 'recurring', 'month', 1, 0,    'per_unit', 'licensed'),
  -- Pro tier
  ('price_pro_monthly_demo',             'prod_pro_demo',         true, 'usd', 'recurring', 'month', 1, 2900, 'per_unit', 'licensed'),
  ('price_pro_annual_demo',              'prod_pro_demo',         true, 'usd', 'recurring', 'year',  1, 29000, 'per_unit', 'licensed'),
  -- Enterprise tier
  ('price_enterprise_monthly_demo',      'prod_enterprise_demo',  true, 'usd', 'recurring', 'month', 1, 9900, 'per_unit', 'licensed'),
  ('price_enterprise_annual_demo',       'prod_enterprise_demo',  true, 'usd', 'recurring', 'year',  1, 99000,'per_unit', 'licensed'),
  -- Metered usage price (API calls)
  ('price_api_calls_metered_demo',       'prod_pro_demo',         true, 'usd', 'recurring', 'month', 1, NULL, 'per_unit', 'metered')
ON CONFLICT (id) DO NOTHING;

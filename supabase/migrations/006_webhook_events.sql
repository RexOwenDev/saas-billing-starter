-- ============================================================
-- 006_webhook_events.sql
-- Idempotency store for Stripe webhook events.
-- BEFORE processing any event, check this table.
-- If stripe_event_id exists → already processed → return 200.
-- This prevents double-billing on Stripe retries.
-- ============================================================

CREATE TYPE webhook_processing_status AS ENUM (
  'processing', -- Currently being handled (prevents concurrent duplicates)
  'succeeded',  -- Handler completed successfully
  'failed'      -- Handler threw an error (will be retried by Stripe)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id   TEXT NOT NULL UNIQUE, -- e.g. evt_1ABC...
  event_type        TEXT NOT NULL,         -- e.g. customer.subscription.updated
  livemode          BOOLEAN NOT NULL DEFAULT false,
  status            webhook_processing_status NOT NULL DEFAULT 'processing',
  -- Serialized event object for debugging / replay
  payload           JSONB,
  -- Error details if status = 'failed'
  error_message     TEXT,
  -- Timing
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  -- How many times Stripe has delivered this event
  attempt_count     INTEGER NOT NULL DEFAULT 1
);

-- The UNIQUE constraint on stripe_event_id is the primary safety mechanism.
-- A second delivery of the same event will fail the INSERT and we return 200.
CREATE INDEX webhook_events_event_type_idx ON webhook_events(event_type);
CREATE INDEX webhook_events_status_idx ON webhook_events(status);
CREATE INDEX webhook_events_received_at_idx ON webhook_events(received_at DESC);

-- Auto-clean events older than 90 days (keep for debugging/audit)
-- In production, consider a cron job for this
CREATE INDEX webhook_events_cleanup_idx ON webhook_events(received_at)
  WHERE received_at < NOW() - INTERVAL '90 days';

-- ============================================================
-- RLS — webhook_events is service-role only (written by webhook handler)
-- No user should ever read or write this table directly
-- ============================================================
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies = no access except service role (which bypasses RLS)

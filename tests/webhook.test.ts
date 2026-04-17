/**
 * tests/webhook.test.ts
 *
 * Tests for the webhook signature verification and idempotency logic.
 * Run with: npx vitest
 *
 * These tests use Stripe's test secret key and constructTestEvent()
 * to generate valid signatures without hitting the real API.
 */

import { describe, it, expect, beforeAll } from "vitest";
import Stripe from "stripe";

// ── Test constants ──────────────────────────────────────────────────────────
const TEST_WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests_only";
const TEST_STRIPE_SECRET = "sk_test_placeholder_not_used_for_api_calls";

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeStripe() {
  return new Stripe(TEST_STRIPE_SECRET, {
    apiVersion: "2025-01-27.acacia",
    typescript: true,
  });
}

function buildPayload(type: string, data: Record<string, unknown>) {
  return JSON.stringify({
    id: `evt_test_${Date.now()}`,
    object: "event",
    api_version: "2025-01-27.acacia",
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    type,
    data: { object: data },
  });
}

// ── Signature verification ───────────────────────────────────────────────────

describe("Webhook signature verification", () => {
  it("accepts a correctly signed payload", () => {
    const stripe = makeStripe();
    const payload = buildPayload("customer.subscription.created", { id: "sub_test" });
    const timestamp = Math.floor(Date.now() / 1000);

    // Stripe's test helper generates a valid signature
    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp,
    });

    // This should not throw
    const event = stripe.webhooks.constructEvent(payload, header, TEST_WEBHOOK_SECRET);
    expect(event.type).toBe("customer.subscription.created");
  });

  it("rejects a payload with a wrong signature", () => {
    const stripe = makeStripe();
    const payload = buildPayload("customer.subscription.created", { id: "sub_test" });

    const badHeader = "t=12345,v1=invalidsignature";

    expect(() =>
      stripe.webhooks.constructEvent(payload, badHeader, TEST_WEBHOOK_SECRET)
    ).toThrow();
  });

  it("rejects a payload with an old timestamp (replay attack)", () => {
    const stripe = makeStripe();
    const payload = buildPayload("customer.subscription.created", { id: "sub_test" });

    // Timestamp that is 10 minutes in the past (beyond the 5-minute tolerance)
    const oldTimestamp = Math.floor(Date.now() / 1000) - 600;

    const header = stripe.webhooks.generateTestHeaderString({
      payload,
      secret: TEST_WEBHOOK_SECRET,
      timestamp: oldTimestamp,
    });

    expect(() =>
      stripe.webhooks.constructEvent(payload, header, TEST_WEBHOOK_SECRET)
    ).toThrow(/timestamp/i);
  });

  it("rejects a tampered payload body", () => {
    const stripe = makeStripe();
    const original = buildPayload("customer.subscription.created", { id: "sub_test" });
    const timestamp = Math.floor(Date.now() / 1000);

    const header = stripe.webhooks.generateTestHeaderString({
      payload: original,
      secret: TEST_WEBHOOK_SECRET,
      timestamp,
    });

    // Simulate attacker changing the amount in the body after signing
    const tampered = original.replace('"id":"sub_test"', '"id":"sub_TAMPERED"');

    expect(() =>
      stripe.webhooks.constructEvent(tampered, header, TEST_WEBHOOK_SECRET)
    ).toThrow();
  });
});

// ── Event type routing ───────────────────────────────────────────────────────

describe("isHandledEventType", () => {
  // Dynamic import so we can test without needing STRIPE_SECRET_KEY set
  let isHandledEventType: (type: string) => boolean;

  beforeAll(async () => {
    // Stub the env var before importing
    process.env.STRIPE_SECRET_KEY = TEST_STRIPE_SECRET;
    process.env.STRIPE_WEBHOOK_SECRET = TEST_WEBHOOK_SECRET;
    const mod = await import("../src/lib/stripe/webhook");
    isHandledEventType = mod.isHandledEventType;
  });

  it("returns true for all handled subscription events", () => {
    const events = [
      "customer.subscription.created",
      "customer.subscription.updated",
      "customer.subscription.deleted",
      "customer.subscription.trial_will_end",
    ];
    events.forEach((e) => expect(isHandledEventType(e)).toBe(true));
  });

  it("returns true for invoice events", () => {
    expect(isHandledEventType("invoice.payment_succeeded")).toBe(true);
    expect(isHandledEventType("invoice.payment_failed")).toBe(true);
  });

  it("returns false for unhandled events", () => {
    expect(isHandledEventType("payment_intent.created")).toBe(false);
    expect(isHandledEventType("radar.early_fraud_warning.created")).toBe(false);
    expect(isHandledEventType("completely.unknown.event")).toBe(false);
  });
});

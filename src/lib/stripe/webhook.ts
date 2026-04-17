import "server-only";
import { stripe } from "./client";
import type Stripe from "stripe";

/**
 * Verifies the Stripe webhook signature and constructs the typed event.
 *
 * IMPORTANT: `rawBody` must be the raw request bytes — do NOT pass a parsed
 * JSON object. Next.js App Router gives us a ReadableStream; read it as text
 * before calling this function.
 *
 * @throws {Error} if the signature is invalid or the timestamp is too old (>5 min)
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }

  // stripe.webhooks.constructEvent validates:
  // 1. HMAC-SHA256 signature against the raw body
  // 2. Timestamp tolerance (default: 300 seconds / 5 minutes)
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

/**
 * Checks whether the event type is one we handle.
 * Unrecognized events return 200 silently — they're valid Stripe events
 * we've chosen not to process.
 */
export function isHandledEventType(eventType: string): boolean {
  const HANDLED: ReadonlySet<string> = new Set([
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "customer.subscription.trial_will_end",
    "customer.subscription.paused",
    "customer.subscription.resumed",
    "invoice.payment_succeeded",
    "invoice.payment_failed",
    "invoice.upcoming",
    "invoice.finalized",
    "checkout.session.completed",
    "checkout.session.expired",
    "customer.created",
    "customer.updated",
    "customer.deleted",
    "billing_portal.configuration.created",
    "billing_portal.session.created",
  ]);
  return HANDLED.has(eventType);
}

import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { verifyWebhookSignature, isHandledEventType } from "@/lib/stripe/webhook";
import { createServiceClient } from "@/lib/supabase/server";
// Subscription handlers
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleSubscriptionTrialWillEnd,
  handleSubscriptionPaused,
  handleSubscriptionResumed,
} from "@/lib/stripe/handlers/subscription";
// Invoice handlers
import {
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleInvoiceFinalized,
  handleInvoiceUpcoming,
} from "@/lib/stripe/handlers/invoice";
// Checkout handlers
import {
  handleCheckoutSessionCompleted,
  handleCheckoutSessionExpired,
} from "@/lib/stripe/handlers/checkout";
// Customer handlers
import {
  handleCustomerCreated,
  handleCustomerUpdated,
  handleCustomerDeleted,
} from "@/lib/stripe/handlers/customer";
// Portal handlers
import {
  handleBillingPortalConfigurationCreated,
  handleBillingPortalSessionCreated,
} from "@/lib/stripe/handlers/portal";

// Tell Next.js to give us the raw body stream — required for HMAC verification.
// JSON parsing must NOT happen before verifyWebhookSignature.
export const runtime = "nodejs";

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── 1. Read raw body (required for HMAC verification) ──────────────────────
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  // ── 2. Verify signature ─────────────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = verifyWebhookSignature(rawBody, signature);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[webhook] Signature verification failed: ${message}`);
    // Return 400 for invalid signatures — this is the only safe non-200
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // ── 3. Skip unhandled event types early (return 200) ───────────────────────
  if (!isHandledEventType(event.type)) {
    return NextResponse.json({ received: true, skipped: true });
  }

  const supabase = createServiceClient();

  // ── 4. Idempotency check — prevent double-processing on Stripe retries ──────
  const { data: existing } = await supabase
    .from("webhook_events")
    .select("id, status")
    .eq("stripe_event_id", event.id)
    .single();

  if (existing) {
    if (existing.status === "succeeded") {
      // Already processed — return 200 immediately
      return NextResponse.json({ received: true, duplicate: true });
    }
    if (existing.status === "processing") {
      // Concurrent delivery — another instance is handling this event.
      // Return 200; Stripe won't retry since we acknowledged.
      return NextResponse.json({ received: true, concurrent: true });
    }
    // status === "failed": Stripe is retrying after our previous failure.
    // Allow reprocessing by falling through to the handler.
  } else {
    // Record the event as "processing" — concurrent duplicates will see this
    // and return early (idempotency window above)
    await supabase.from("webhook_events").insert({
      stripe_event_id: event.id,
      event_type: event.type,
      livemode: event.livemode,
      status: "processing",
      payload: event as unknown as Record<string, unknown>,
    });
  }

  // ── 5. Route to the correct handler ────────────────────────────────────────
  // IMPORTANT: ALL errors inside handlers are caught here.
  // We NEVER propagate a 5xx to Stripe — that triggers retries.
  try {
    await routeEvent(event);

    // Mark as succeeded
    await supabase
      .from("webhook_events")
      .update({ status: "succeeded", processed_at: new Date().toISOString() })
      .eq("stripe_event_id", event.id);

    return NextResponse.json({ received: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Handler failed for ${event.type} (${event.id}): ${message}`);

    // Mark as failed so Stripe retries can reprocess
    await supabase
      .from("webhook_events")
      .update({ status: "failed", error_message: message })
      .eq("stripe_event_id", event.id);

    // Return 200 — Stripe will retry based on our retry schedule anyway.
    // A 5xx here would cause exponential retry storms.
    return NextResponse.json({ received: true, error: message });
  }
}

/**
 * Routes the verified Stripe event to the appropriate handler.
 * TypeScript exhaustive checking ensures we don't miss an event type.
 */
async function routeEvent(event: Stripe.Event): Promise<void> {
  const obj = event.data.object;

  switch (event.type) {
    // ── Subscription lifecycle ──────────────────────────────────────────────
    case "customer.subscription.created":
      return handleSubscriptionCreated(obj as Stripe.Subscription);
    case "customer.subscription.updated":
      return handleSubscriptionUpdated(obj as Stripe.Subscription);
    case "customer.subscription.deleted":
      return handleSubscriptionDeleted(obj as Stripe.Subscription);
    case "customer.subscription.trial_will_end":
      return handleSubscriptionTrialWillEnd(obj as Stripe.Subscription);
    case "customer.subscription.paused":
      return handleSubscriptionPaused(obj as Stripe.Subscription);
    case "customer.subscription.resumed":
      return handleSubscriptionResumed(obj as Stripe.Subscription);

    // ── Invoice lifecycle ───────────────────────────────────────────────────
    case "invoice.payment_succeeded":
      return handleInvoicePaymentSucceeded(obj as Stripe.Invoice);
    case "invoice.payment_failed":
      return handleInvoicePaymentFailed(obj as Stripe.Invoice);
    case "invoice.finalized":
      return handleInvoiceFinalized(obj as Stripe.Invoice);
    case "invoice.upcoming":
      return handleInvoiceUpcoming(obj as Stripe.Invoice);

    // ── Checkout ────────────────────────────────────────────────────────────
    case "checkout.session.completed":
      return handleCheckoutSessionCompleted(obj as Stripe.Checkout.Session);
    case "checkout.session.expired":
      return handleCheckoutSessionExpired(obj as Stripe.Checkout.Session);

    // ── Customer ────────────────────────────────────────────────────────────
    case "customer.created":
      return handleCustomerCreated(obj as Stripe.Customer);
    case "customer.updated":
      return handleCustomerUpdated(obj as Stripe.Customer);
    case "customer.deleted":
      return handleCustomerDeleted(obj as Stripe.Customer);

    // ── Billing portal ──────────────────────────────────────────────────────
    case "billing_portal.configuration.created":
      return handleBillingPortalConfigurationCreated(
        obj as Stripe.BillingPortal.Configuration
      );
    case "billing_portal.session.created":
      return handleBillingPortalSessionCreated(
        obj as Stripe.BillingPortal.Session
      );

    default:
      // isHandledEventType() filters out unknown events before we get here,
      // so this branch is a TypeScript safety net only.
      console.warn(`[webhook] No handler for event type: ${event.type}`);
  }
}

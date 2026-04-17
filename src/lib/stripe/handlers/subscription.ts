import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeSubscriptionStatus } from "@/lib/stripe/subscriptions";
import { getCustomerByStripeId } from "@/lib/stripe/customer";

/**
 * Handles all customer.subscription.* events.
 * Keeps the subscriptions table in sync with Stripe's source of truth.
 *
 * ALL handlers must:
 * - Never throw (errors are caught at the router level)
 * - Never return 5xx to Stripe
 * - Be idempotent (safe to replay)
 */
export async function handleSubscriptionCreated(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();
  const customer = await getCustomerByStripeId(subscription.customer as string);

  if (!customer) {
    console.error(
      `[webhook] subscription.created: no customer found for ${subscription.customer}`
    );
    return;
  }

  const firstItem = subscription.items.data[0];
  if (!firstItem) {
    console.error(`[webhook] subscription.created: no items on ${subscription.id}`);
    return;
  }

  await supabase.from("subscriptions").upsert({
    id: subscription.id,
    org_id: customer.org_id,
    customer_id: subscription.customer as string,
    status: normalizeSubscriptionStatus(subscription.status),
    price_id: firstItem.price.id,
    product_id: firstItem.price.product as string,
    quantity: firstItem.quantity ?? 1,
    trial_start: subscription.trial_start
      ? new Date(subscription.trial_start * 1000).toISOString()
      : null,
    trial_end: subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : null,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at
      ? new Date(subscription.canceled_at * 1000).toISOString()
      : null,
    cancel_at: subscription.cancel_at
      ? new Date(subscription.cancel_at * 1000).toISOString()
      : null,
    ended_at: subscription.ended_at
      ? new Date(subscription.ended_at * 1000).toISOString()
      : null,
    latest_invoice_id:
      typeof subscription.latest_invoice === "string"
        ? subscription.latest_invoice
        : (subscription.latest_invoice?.id ?? null),
    metadata: (subscription.metadata ?? {}) as Record<string, string>,
  });

  console.log(`[webhook] subscription.created: ${subscription.id} (org: ${customer.org_id})`);
}

export async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
): Promise<void> {
  // Updated uses the same upsert logic as created — Stripe sends full objects
  await handleSubscriptionCreated(subscription);
  console.log(`[webhook] subscription.updated: ${subscription.id}`);
}

export async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();

  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      ended_at: subscription.ended_at
        ? new Date(subscription.ended_at * 1000).toISOString()
        : new Date().toISOString(),
    })
    .eq("id", subscription.id);

  console.log(`[webhook] subscription.deleted: ${subscription.id}`);
}

export async function handleSubscriptionTrialWillEnd(
  subscription: Stripe.Subscription
): Promise<void> {
  // Trigger: sent 3 days before trial ends
  // In production: send a "trial ending soon" email here
  console.log(
    `[webhook] subscription.trial_will_end: ${subscription.id} — ` +
      `trial ends ${subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : "unknown"}`
  );
  // TODO: Send trial-ending email notification
}

export async function handleSubscriptionPaused(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("subscriptions")
    .update({ status: "paused" })
    .eq("id", subscription.id);

  console.log(`[webhook] subscription.paused: ${subscription.id}`);
}

export async function handleSubscriptionResumed(
  subscription: Stripe.Subscription
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("subscriptions")
    .update({ status: "active" })
    .eq("id", subscription.id);

  console.log(`[webhook] subscription.resumed: ${subscription.id}`);
}

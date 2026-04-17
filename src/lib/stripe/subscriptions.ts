import "server-only";
import { stripe } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import type { Subscription, SubscriptionStatus } from "@/types/database";
import type { PlanTier } from "@/types/billing";
import { PLAN_CONFIGS } from "@/types/billing";

/**
 * Returns the active subscription for an org, or null if none.
 * Reads from Supabase (source of truth for subscription state).
 */
export async function getSubscription(orgId: string): Promise<Subscription | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("org_id", orgId)
    .not("status", "in", '("canceled","incomplete_expired")')
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  return data ?? null;
}

/**
 * Returns the plan tier for an org based on their active subscription.
 * Falls back to "free" if no active subscription exists.
 */
export async function getPlanTier(orgId: string): Promise<PlanTier> {
  const subscription = await getSubscription(orgId);

  if (!subscription || !["active", "trialing"].includes(subscription.status)) {
    return "free";
  }

  // Match the product_id against our known plan configs
  for (const [tier, config] of Object.entries(PLAN_CONFIGS)) {
    const isMonthly = subscription.price_id === config.stripePriceIdMonthly;
    const isAnnual = subscription.price_id === config.stripePriceIdAnnual;
    if (isMonthly || isAnnual) return tier as PlanTier;
  }

  return "free";
}

/**
 * Cancels a subscription at the end of the current billing period.
 * The subscription stays active until period_end — customer keeps access.
 * Use cancelImmediately: true for immediate cancellation (rare, check refund policy).
 */
export async function cancelSubscription(
  subscriptionId: string,
  options: { immediately?: boolean } = {}
): Promise<void> {
  if (options.immediately) {
    await stripe.subscriptions.cancel(subscriptionId);
  } else {
    await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }
  // Subscription state is updated asynchronously via the
  // customer.subscription.updated webhook event
}

/**
 * Resumes a subscription that was scheduled for cancellation.
 * Clears the cancel_at_period_end flag.
 */
export async function resumeSubscription(subscriptionId: string): Promise<void> {
  await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Changes the plan (price) on an existing subscription.
 * Stripe prorates the change by default.
 *
 * proration_behavior options:
 * - "create_prorations" (default): credit/debit difference
 * - "none": no proration, change takes effect next period
 * - "always_invoice": invoice immediately for the proration
 */
export async function changePlan(params: {
  subscriptionId: string;
  newPriceId: string;
  prorationBehavior?: "create_prorations" | "none" | "always_invoice";
}): Promise<void> {
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
  const firstItem = subscription.items.data[0];

  if (!firstItem) {
    throw new Error(`Subscription ${params.subscriptionId} has no items`);
  }

  await stripe.subscriptions.update(params.subscriptionId, {
    items: [{ id: firstItem.id, price: params.newPriceId }],
    proration_behavior: params.prorationBehavior ?? "create_prorations",
  });
}

/**
 * Retrieves the full Stripe subscription object (live, not cached).
 * Use for admin/debug — for app logic, prefer getSubscription() which reads Supabase.
 */
export async function getStripeSubscription(subscriptionId: string) {
  return stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["latest_invoice", "customer", "items.data.price.product"],
  });
}

/**
 * Maps a Stripe subscription status string to our DB enum.
 */
export function normalizeSubscriptionStatus(
  stripeStatus: string
): SubscriptionStatus {
  const valid: SubscriptionStatus[] = [
    "incomplete",
    "incomplete_expired",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "unpaid",
    "paused",
  ];
  return valid.includes(stripeStatus as SubscriptionStatus)
    ? (stripeStatus as SubscriptionStatus)
    : "incomplete";
}

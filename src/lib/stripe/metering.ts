import "server-only";
import { stripe } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import type { MeteredEvent } from "@/types/billing";

/**
 * Reports a usage event to Stripe for metered billing.
 * Called at the moment a billable action occurs (e.g. an API call, file upload).
 *
 * idempotencyKey: supply a stable key (e.g. request ID) to prevent double-reporting
 * if the function is retried. Stripe deduplicates on this key.
 */
export async function reportUsage(params: {
  subscriptionItemId: string;
  orgId: string;
  subscriptionId: string;
  feature: MeteredEvent;
  quantity: number;
  timestamp?: number; // Unix seconds — defaults to now
  idempotencyKey?: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const timestamp = params.timestamp ?? Math.floor(Date.now() / 1000);

  // Check idempotency before calling Stripe
  if (params.idempotencyKey) {
    const { data: existing } = await supabase
      .from("usage_records")
      .select("id")
      .eq("org_id", params.orgId)
      .eq("feature", params.feature)
      .eq("idempotency_key", params.idempotencyKey)
      .single();

    if (existing) return; // Already reported
  }

  // Report to Stripe (stub: no-op when STRIPE_SECRET_KEY is test key or missing)
  const stripeRecord = await stripe.subscriptionItems.createUsageRecord(
    params.subscriptionItemId,
    {
      quantity: params.quantity,
      timestamp,
      action: "increment",
    },
    params.idempotencyKey ? { idempotencyKey: params.idempotencyKey } : undefined
  );

  // Get current billing period from subscription
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
  const currentPeriodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  // Persist locally for dashboard display and audit
  await supabase.from("usage_records").insert({
    org_id: params.orgId,
    subscription_id: params.subscriptionId,
    feature: params.feature,
    quantity: params.quantity,
    occurred_at: new Date(timestamp * 1000).toISOString(),
    idempotency_key: params.idempotencyKey ?? null,
    stripe_usage_record_id: stripeRecord.id,
    reported_at: new Date().toISOString(),
    billing_period_start: currentPeriodStart,
    billing_period_end: currentPeriodEnd,
  });
}

/**
 * Returns total usage for a feature in the current billing period.
 */
export async function getUsageSummary(params: {
  orgId: string;
  subscriptionId: string;
  feature: MeteredEvent;
}): Promise<{ total: number; periodStart: string; periodEnd: string }> {
  const supabase = createServiceClient();

  // Get current period boundaries from the subscription
  const subscription = await stripe.subscriptions.retrieve(params.subscriptionId);
  const periodStart = new Date(subscription.current_period_start * 1000).toISOString();
  const periodEnd = new Date(subscription.current_period_end * 1000).toISOString();

  const { data } = await supabase
    .from("usage_records")
    .select("quantity")
    .eq("org_id", params.orgId)
    .eq("feature", params.feature)
    .gte("billing_period_start", periodStart)
    .lte("billing_period_end", periodEnd);

  const total = (data ?? []).reduce((sum, r) => sum + r.quantity, 0);

  return { total, periodStart, periodEnd };
}

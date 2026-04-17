import "server-only";
import { stripe } from "./client";
import { createOrGetCustomer } from "./customer";
import type { BillingInterval } from "@/types/billing";
import { PLAN_CONFIGS } from "@/types/billing";

interface CreateCheckoutSessionParams {
  orgId: string;
  userEmail: string;
  userName?: string;
  priceId: string;
  billingInterval: BillingInterval;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  /** Idempotency key prevents duplicate sessions on retry */
  idempotencyKey?: string;
}

interface CheckoutSessionResult {
  sessionId: string;
  url: string;
}

/**
 * Creates a Stripe Checkout Session for subscription sign-up.
 * Returns the session URL — redirect the user to it client-side.
 *
 * This is a stub: in production, wire up success/cancel webhooks
 * and handle checkout.session.completed in the webhook handler.
 */
export async function createCheckoutSession(
  params: CreateCheckoutSessionParams
): Promise<CheckoutSessionResult> {
  const customer = await createOrGetCustomer({
    orgId: params.orgId,
    email: params.userEmail,
    name: params.userName,
  });

  const session = await stripe.checkout.sessions.create(
    {
      customer: customer.stripe_customer_id,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: params.priceId, quantity: 1 }],
      subscription_data: {
        trial_period_days: params.trialDays,
        metadata: { org_id: params.orgId },
      },
      // Allow customer to update billing details during checkout
      customer_update: { address: "auto" },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      // Collect billing address for tax compliance
      billing_address_collection: "auto",
      // Enable automatic tax if you've enabled Stripe Tax
      automatic_tax: { enabled: false },
      metadata: { org_id: params.orgId },
    },
    params.idempotencyKey
      ? { idempotencyKey: params.idempotencyKey }
      : undefined
  );

  if (!session.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  return { sessionId: session.id, url: session.url };
}

/**
 * Creates a checkout session for plan upgrade/downgrade.
 * Uses the existing customer and handles proration automatically.
 */
export async function createUpgradeSession(params: {
  orgId: string;
  newPriceId: string;
  currentSubscriptionId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<CheckoutSessionResult> {
  const customer = await import("./customer").then((m) =>
    m.getCustomerByOrgId(params.orgId)
  );

  if (!customer) throw new Error(`No customer found for org ${params.orgId}`);

  const session = await stripe.checkout.sessions.create({
    customer: customer.stripe_customer_id,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: params.newPriceId, quantity: 1 }],
    subscription_data: { metadata: { org_id: params.orgId } },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
    metadata: { org_id: params.orgId, upgrade: "true" },
  });

  if (!session.url) throw new Error("Stripe did not return a checkout URL");

  return { sessionId: session.id, url: session.url };
}

/**
 * Returns price IDs for a given plan tier and interval.
 * Convenience wrapper over PLAN_CONFIGS.
 */
export function getPriceIdForPlan(
  tier: keyof typeof PLAN_CONFIGS,
  interval: BillingInterval
): string {
  const config = PLAN_CONFIGS[tier];
  return interval === "month"
    ? config.stripePriceIdMonthly
    : config.stripePriceIdAnnual;
}

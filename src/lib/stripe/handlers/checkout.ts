import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
): Promise<void> {
  if (session.mode !== "subscription") {
    // Only handle subscription checkouts; ignore one-time payment sessions
    return;
  }

  const orgId = session.metadata?.["org_id"];
  if (!orgId) {
    console.error(
      `[webhook] checkout.session.completed: no org_id in metadata for session ${session.id}`
    );
    return;
  }

  const supabase = createServiceClient();

  // Ensure the customer record is up to date (email may have changed during checkout)
  if (session.customer && session.customer_details?.email) {
    await supabase
      .from("customers")
      .update({ email: session.customer_details.email })
      .eq("stripe_customer_id", session.customer as string);
  }

  // The subscription record is created/updated by the
  // customer.subscription.created event that fires alongside this one.
  // We just need to handle any checkout-specific logic here.
  console.log(
    `[webhook] checkout.session.completed: session ${session.id} ` +
      `(org: ${orgId}, subscription: ${session.subscription as string})`
  );

  // TODO: Send welcome email, trigger onboarding flow
}

export async function handleCheckoutSessionExpired(
  session: Stripe.Checkout.Session
): Promise<void> {
  const orgId = session.metadata?.["org_id"];
  console.log(
    `[webhook] checkout.session.expired: session ${session.id} (org: ${orgId ?? "unknown"})`
  );
  // In production: send "checkout abandoned" re-engagement email
}

import "server-only";
import { stripe } from "./client";
import { getCustomerByOrgId } from "./customer";

interface CreatePortalSessionParams {
  orgId: string;
  returnUrl: string;
}

/**
 * Creates a Stripe Customer Portal session.
 * The portal lets customers manage their subscription, payment method,
 * billing address, and download invoices — all hosted by Stripe.
 *
 * Configure portal settings at:
 * https://dashboard.stripe.com/test/settings/billing/portal
 */
export async function createPortalSession(
  params: CreatePortalSessionParams
): Promise<{ url: string }> {
  const customer = await getCustomerByOrgId(params.orgId);

  if (!customer) {
    throw new Error(
      `No Stripe customer found for org ${params.orgId}. ` +
        "The user must complete checkout before accessing the portal."
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customer.stripe_customer_id,
    return_url: params.returnUrl,
  });

  return { url: session.url };
}

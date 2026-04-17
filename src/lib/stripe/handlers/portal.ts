import "server-only";
import type Stripe from "stripe";

export async function handleBillingPortalConfigurationCreated(
  config: Stripe.BillingPortal.Configuration
): Promise<void> {
  // Informational — portal configuration was created/updated in Stripe Dashboard.
  // No DB action needed; useful for audit logging.
  console.log(`[webhook] billing_portal.configuration.created: ${config.id}`);
}

export async function handleBillingPortalSessionCreated(
  session: Stripe.BillingPortal.Session
): Promise<void> {
  // Informational — a customer started a portal session.
  // Log for audit trail if needed.
  console.log(
    `[webhook] billing_portal.session.created: customer ${session.customer}`
  );
}

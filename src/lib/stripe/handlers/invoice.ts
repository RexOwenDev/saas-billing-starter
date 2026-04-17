import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getCustomerByStripeId } from "@/lib/stripe/customer";

async function upsertInvoice(invoice: Stripe.Invoice): Promise<void> {
  const supabase = createServiceClient();
  const customer = await getCustomerByStripeId(invoice.customer as string);

  if (!customer) {
    console.error(`[webhook] invoice handler: no customer for ${invoice.customer}`);
    return;
  }

  await supabase.from("invoices").upsert({
    id: invoice.id,
    org_id: customer.org_id,
    customer_id: invoice.customer as string,
    subscription_id:
      typeof invoice.subscription === "string"
        ? invoice.subscription
        : (invoice.subscription?.id ?? null),
    status: (invoice.status ?? "draft") as
      | "draft"
      | "open"
      | "paid"
      | "uncollectible"
      | "void",
    amount_due: invoice.amount_due,
    amount_paid: invoice.amount_paid,
    amount_remaining: invoice.amount_remaining,
    currency: invoice.currency,
    period_start: invoice.period_start
      ? new Date(invoice.period_start * 1000).toISOString()
      : null,
    period_end: invoice.period_end
      ? new Date(invoice.period_end * 1000).toISOString()
      : null,
    due_date: invoice.due_date
      ? new Date(invoice.due_date * 1000).toISOString()
      : null,
    paid_at:
      invoice.status_transitions?.paid_at
        ? new Date(invoice.status_transitions.paid_at * 1000).toISOString()
        : null,
    hosted_invoice_url: invoice.hosted_invoice_url ?? null,
    invoice_pdf: invoice.invoice_pdf ?? null,
    description: invoice.description ?? null,
  });
}

export async function handleInvoicePaymentSucceeded(
  invoice: Stripe.Invoice
): Promise<void> {
  await upsertInvoice(invoice);

  // In production: send receipt email, unlock features, update usage quotas
  console.log(
    `[webhook] invoice.payment_succeeded: ${invoice.id} ` +
      `(${invoice.currency.toUpperCase()} ${(invoice.amount_paid / 100).toFixed(2)})`
  );
}

export async function handleInvoicePaymentFailed(
  invoice: Stripe.Invoice
): Promise<void> {
  await upsertInvoice(invoice);

  // In production: send dunning email, notify account owner, update subscription status
  // Stripe handles automatic retries per your retry schedule
  console.log(
    `[webhook] invoice.payment_failed: ${invoice.id} ` +
      `— attempt ${invoice.attempt_count ?? 1}`
  );
  // TODO: Send payment failure notification
}

export async function handleInvoiceFinalized(invoice: Stripe.Invoice): Promise<void> {
  await upsertInvoice(invoice);
  console.log(`[webhook] invoice.finalized: ${invoice.id}`);
}

export async function handleInvoiceUpcoming(invoice: Stripe.Invoice): Promise<void> {
  // Sent ~7 days before the invoice is finalized
  // In production: send "upcoming charge" notification
  console.log(
    `[webhook] invoice.upcoming: customer ${invoice.customer} ` +
      `— ${invoice.currency.toUpperCase()} ${(invoice.amount_due / 100).toFixed(2)} upcoming`
  );
  // TODO: Send upcoming renewal notification
}

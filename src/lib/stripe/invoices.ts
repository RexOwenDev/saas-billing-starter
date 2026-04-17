import "server-only";
import { stripe } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import type { Invoice } from "@/types/database";

/**
 * Returns paginated invoice history for an org from Supabase.
 * Supabase is kept in sync by invoice.* webhook events.
 */
export async function listInvoices(
  orgId: string,
  limit = 10
): Promise<Invoice[]> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("invoices")
    .select("*")
    .eq("org_id", orgId)
    .not("status", "eq", "draft")
    .order("created_at", { ascending: false })
    .limit(limit);

  return data ?? [];
}

/**
 * Returns the upcoming invoice for the org's active subscription.
 * Fetches live from Stripe — useful for showing the next charge amount.
 */
export async function getUpcomingInvoice(stripeCustomerId: string) {
  try {
    return await stripe.invoices.retrieveUpcoming({
      customer: stripeCustomerId,
    });
  } catch (error) {
    // Stripe throws if there is no upcoming invoice (e.g. canceled subscription)
    if (
      error instanceof Error &&
      error.message.includes("No upcoming invoices")
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Format an invoice amount (cents → display string).
 * e.g. 2900, "usd" → "$29.00"
 */
export function formatInvoiceAmount(amountCents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

import "server-only";
import { stripe } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import type { Customer } from "@/types/database";

/**
 * Returns the Stripe customer for an org, creating one if it doesn't exist.
 * Always use this instead of creating customers directly — it prevents duplicates.
 */
export async function createOrGetCustomer(params: {
  orgId: string;
  email: string;
  name?: string;
}): Promise<Customer> {
  const supabase = createServiceClient();

  // Check if we already have a customer record for this org
  const { data: existing } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", params.orgId)
    .single();

  if (existing) return existing;

  // Create in Stripe first, then persist locally
  const stripeCustomer = await stripe.customers.create({
    email: params.email,
    name: params.name,
    metadata: { org_id: params.orgId },
  });

  const { data: customer, error } = await supabase
    .from("customers")
    .insert({
      org_id: params.orgId,
      stripe_customer_id: stripeCustomer.id,
      email: params.email,
      name: params.name ?? null,
    })
    .select()
    .single();

  if (error || !customer) {
    throw new Error(`Failed to persist customer: ${error?.message}`);
  }

  return customer;
}

/**
 * Look up our customer record by Stripe customer ID.
 * Used in webhook handlers where we receive stripe_customer_id.
 */
export async function getCustomerByStripeId(
  stripeCustomerId: string
): Promise<Customer | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .single();

  return data ?? null;
}

/**
 * Look up customer by org ID (for authenticated app routes).
 */
export async function getCustomerByOrgId(orgId: string): Promise<Customer | null> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("customers")
    .select("*")
    .eq("org_id", orgId)
    .single();

  return data ?? null;
}

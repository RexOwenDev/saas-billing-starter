import "server-only";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";

export async function handleCustomerCreated(
  customer: Stripe.Customer
): Promise<void> {
  // Our app creates customers proactively via createOrGetCustomer(),
  // so this event typically fires for customers we already have.
  // Update the record if needed.
  const supabase = createServiceClient();
  const orgId = customer.metadata["org_id"];

  if (!orgId) return; // Not a customer created by our app

  await supabase
    .from("customers")
    .upsert({
      org_id: orgId,
      stripe_customer_id: customer.id,
      email: customer.email ?? "",
      name: customer.name ?? null,
    })
    .eq("stripe_customer_id", customer.id);

  console.log(`[webhook] customer.created: ${customer.id} (org: ${orgId})`);
}

export async function handleCustomerUpdated(
  customer: Stripe.Customer
): Promise<void> {
  const supabase = createServiceClient();

  // Keep email/name in sync (customer may update via portal)
  await supabase
    .from("customers")
    .update({
      email: customer.email ?? "",
      name: customer.name ?? null,
    })
    .eq("stripe_customer_id", customer.id);

  console.log(`[webhook] customer.updated: ${customer.id}`);
}

export async function handleCustomerDeleted(
  customer: Stripe.Customer
): Promise<void> {
  // Stripe "deletes" customers when you call stripe.customers.del()
  // In practice, for SaaS apps we cancel the subscription instead.
  // If a customer is deleted, clean up our reference.
  const supabase = createServiceClient();

  await supabase
    .from("customers")
    .delete()
    .eq("stripe_customer_id", customer.id);

  console.log(`[webhook] customer.deleted: ${customer.id}`);
}

import "server-only";
import { stripe } from "./client";
import { createServiceClient } from "@/lib/supabase/server";
import type { Product, Price } from "@/types/database";

/**
 * Syncs Stripe products and prices into Supabase.
 * Called by scripts/seed-stripe-products.ts and by product.* webhook events.
 * Idempotent: upserts on the Stripe ID primary key.
 */
export async function syncProductsAndPrices(): Promise<void> {
  const supabase = createServiceClient();

  // Fetch all active products from Stripe
  const products = await stripe.products.list({ active: true, limit: 100 });

  for (const p of products.data) {
    await supabase.from("products").upsert({
      id: p.id,
      name: p.name,
      description: p.description ?? null,
      active: p.active,
      metadata: (p.metadata ?? {}) as Record<string, string>,
    });

    // Fetch all prices for this product
    const prices = await stripe.prices.list({
      product: p.id,
      active: true,
      limit: 100,
    });

    for (const price of prices.data) {
      await supabase.from("prices").upsert({
        id: price.id,
        product_id: p.id,
        active: price.active,
        currency: price.currency,
        type: price.type,
        interval: price.recurring?.interval ?? null,
        interval_count: price.recurring?.interval_count ?? null,
        unit_amount: price.unit_amount ?? null,
        billing_scheme: price.billing_scheme as "per_unit" | "tiered",
        usage_type: (price.recurring?.usage_type ?? "licensed") as "licensed" | "metered",
        aggregate_usage: price.recurring?.aggregate_usage ?? null,
        metadata: (price.metadata ?? {}) as Record<string, string>,
      });
    }
  }
}

/**
 * Returns all active prices from Supabase (with joined product data).
 * Used by the pricing page to render plan cards.
 */
export async function getActivePrices(): Promise<
  Array<Price & { product: Product }>
> {
  const supabase = createServiceClient();

  const { data } = await supabase
    .from("prices")
    .select("*, product:products(*)")
    .eq("active", true)
    .order("unit_amount", { ascending: true });

  return (data ?? []) as Array<Price & { product: Product }>;
}

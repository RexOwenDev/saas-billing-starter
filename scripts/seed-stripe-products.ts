/**
 * scripts/seed-stripe-products.ts
 *
 * Idempotently creates Stripe products and prices in test mode.
 * Run once after setting up your Stripe test account:
 *   npm run seed:stripe
 *
 * After running, copy the generated price IDs into your .env.local.
 */

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is required. Copy .env.example to .env.local first.");
}

if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
  throw new Error(
    "STRIPE_SECRET_KEY must be a TEST key (sk_test_...). " +
      "Never seed products against live keys."
  );
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-01-27.acacia",
  typescript: true,
});

interface PlanSeed {
  name: string;
  description: string;
  tier: string;
  prices: Array<{
    interval: "month" | "year";
    amount: number; // cents
    lookupKey: string;
  }>;
}

const PLANS: PlanSeed[] = [
  {
    name: "Free",
    description: "For individuals and small projects",
    tier: "free",
    prices: [
      { interval: "month", amount: 0, lookupKey: "free_monthly" },
    ],
  },
  {
    name: "Pro",
    description: "For growing teams that need more power",
    tier: "pro",
    prices: [
      { interval: "month", amount: 2900, lookupKey: "pro_monthly" },
      { interval: "year", amount: 29000, lookupKey: "pro_annual" },
    ],
  },
  {
    name: "Enterprise",
    description: "For scaling organizations with custom needs",
    tier: "enterprise",
    prices: [
      { interval: "month", amount: 9900, lookupKey: "enterprise_monthly" },
      { interval: "year", amount: 99000, lookupKey: "enterprise_annual" },
    ],
  },
];

async function findOrCreateProduct(plan: PlanSeed): Promise<Stripe.Product> {
  // Check by metadata to be idempotent
  const existing = await stripe.products.search({
    query: `metadata["tier"]:"${plan.tier}"`,
  });

  if (existing.data.length > 0 && existing.data[0]) {
    console.log(`  ✓ Product "${plan.name}" already exists: ${existing.data[0].id}`);
    return existing.data[0];
  }

  const product = await stripe.products.create({
    name: plan.name,
    description: plan.description,
    metadata: { tier: plan.tier },
  });

  console.log(`  ✦ Created product "${plan.name}": ${product.id}`);
  return product;
}

async function findOrCreatePrice(
  productId: string,
  seed: PlanSeed["prices"][number]
): Promise<Stripe.Price> {
  // Check by lookup key to be idempotent
  try {
    const existing = await stripe.prices.retrieve(seed.lookupKey);
    console.log(`    ✓ Price "${seed.lookupKey}" already exists: ${existing.id}`);
    return existing;
  } catch {
    // Price not found — create it
  }

  const price = await stripe.prices.create({
    product: productId,
    currency: "usd",
    unit_amount: seed.amount,
    recurring: { interval: seed.interval },
    lookup_key: seed.lookupKey,
    transfer_lookup_key: true,
    metadata: { lookup_key: seed.lookupKey },
  });

  console.log(`    ✦ Created price "${seed.lookupKey}": ${price.id}`);
  return price;
}

async function main() {
  console.log("\n🚀 Seeding Stripe test products and prices...\n");

  const priceMap: Record<string, string> = {};

  for (const plan of PLANS) {
    console.log(`\n📦 ${plan.name}`);
    const product = await findOrCreateProduct(plan);

    for (const priceSeed of plan.prices) {
      const price = await findOrCreatePrice(product.id, priceSeed);
      priceMap[priceSeed.lookupKey] = price.id;
    }
  }

  console.log("\n✅ Seeding complete!\n");
  console.log("Add these to your .env.local:\n");
  console.log(`STRIPE_PRO_MONTHLY_PRICE_ID=${priceMap["pro_monthly"] ?? ""}`);
  console.log(`STRIPE_PRO_ANNUAL_PRICE_ID=${priceMap["pro_annual"] ?? ""}`);
  console.log(`STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=${priceMap["enterprise_monthly"] ?? ""}`);
  console.log(`STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=${priceMap["enterprise_annual"] ?? ""}`);
  console.log("");
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});

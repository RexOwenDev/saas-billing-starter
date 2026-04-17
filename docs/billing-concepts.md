# Billing Concepts

Design rationale behind the billing model, data schema, and tenant isolation strategy.

---

## Plan tiers

Three tiers are defined in `src/types/billing.ts`:

| Tier | Intended for | Price model |
|---|---|---|
| `free` | Individual / evaluation | No payment required |
| `pro` | Small teams | Monthly or annual flat-rate |
| `enterprise` | Large orgs | Monthly or annual flat-rate + metered usage |

Plan features and limits live in `PLAN_CONFIGS` — a single source of truth used by:
- The pricing table UI (`PricingCard`, `FeatureList`)
- Server-side gate checks (`getPlanTier`, `hasFeature`, `getFeatureLimit`)
- Usage limit enforcement (`isOverLimit`, `checkAllLimits`)
- Proration estimates (`estimateProration`)

Adding a tier means updating `PLAN_CONFIGS` — no other file needs changing.

---

## Subscription states

The `subscription_status` enum mirrors Stripe's subscription statuses with one addition:

| Status | Meaning |
|---|---|
| `trialing` | Free trial period, payment method on file |
| `active` | Paid and current |
| `past_due` | Payment failed, Stripe retrying |
| `canceled` | Subscription ended |
| `unpaid` | Payment failed, dunning exhausted, Stripe stopped retrying |
| `incomplete` | Initial payment pending (checkout not yet paid) |
| `incomplete_expired` | Initial payment never made — subscription expired |
| `paused` | Temporarily paused (Stripe feature) |

The `UNIQUE INDEX one_active_subscription_per_org` partial index enforces that each organization can have at most one non-terminated subscription:

```sql
CREATE UNIQUE INDEX one_active_subscription_per_org
  ON subscriptions (org_id)
  WHERE status NOT IN ('canceled', 'incomplete_expired');
```

This prevents duplicate active subscriptions from concurrent checkout attempts.

---

## Metered usage

Two metered event types are pre-configured:

| Event | Unit | Stripe price type |
|---|---|---|
| `api_calls` | Integer count | `usage_type = metered` |
| `storage_gb` | Gigabytes (float) | `usage_type = metered` |

Usage is tracked in two places:

1. **`usage_records` table** — local record with idempotency key; queried for usage meters in the UI
2. **Stripe Meters API** — authoritative for billing calculations; called from `reportUsage()` after the local check

The local idempotency check runs before the Stripe call:

```typescript
const existing = await supabase
  .from("usage_records")
  .select("id")
  .eq("org_id", orgId)
  .eq("idempotency_key", idempotencyKey)
  .single();

if (existing.data) return; // already reported
```

This prevents double-counting on application-level retries (e.g., if your API route retries on timeout).

### Usage periods

`getBillingPeriod()` in `src/lib/billing/periods.ts` returns the current billing period from the active subscription's `current_period_start` / `current_period_end`. Usage meters in the UI show consumption within the current period only — the `usage_records` table is queried with a `period_start >= ?` filter.

---

## Proration

When a user upgrades or downgrades mid-cycle, Stripe calculates proration automatically. The `estimateProration()` helper in `src/lib/billing/proration.ts` gives a client-side preview before the user confirms:

```
unusedCredit   = -(currentPriceAmount × fractionOfPeriodRemaining)
newPlanCharge  = newPriceAmount × fractionOfPeriodRemaining
estimatedTotal = unusedCredit + newPlanCharge
```

This is an approximation — Stripe's actual calculation accounts for prorated invoice line items, taxes, and coupons. The real amount is shown in the Stripe Checkout or Customer Portal before payment is confirmed.

The `changePlan()` function in `src/lib/stripe/subscriptions.ts` passes `proration_behavior: "create_prorations"` to Stripe, which creates a prorated invoice immediately on upgrade and applies an unused credit on downgrade.

---

## Trial handling

New subscriptions get a 14-day trial by default:

```typescript
trial_period_days: 14,
payment_method_collection: "if_required",
```

`payment_method_collection: "if_required"` means Stripe only asks for a card if the trial would transition to a paid plan. For the `free` tier there is no charge, so no card is collected.

`trialDaysRemaining()` in `src/lib/billing/periods.ts` computes days left from `subscription.trial_end`:

```typescript
export function trialDaysRemaining(trialEnd: Date): number {
  const now = new Date();
  if (trialEnd <= now) return 0;
  return Math.ceil((trialEnd.getTime() - now.getTime()) / MS_PER_DAY);
}
```

The billing dashboard shows a trial banner when `isTrialing(subscription)` returns true.

---

## Tenant isolation (Row-Level Security)

Every table with user data has RLS enabled. The policy pattern is consistent:

```sql
-- Members of an org can read their own data
CREATE POLICY "org_members_read"
  ON table_name FOR SELECT
  USING (
    org_id IN (
      SELECT org_id FROM organization_members
      WHERE user_id = auth.uid()
    )
  );
```

Ownership checks use `organization_members` as the join — a user must be a member of the org to access its billing data. This means:

- Multi-tenancy is enforced at the DB layer, not just the application layer
- Even if an API route has a bug and passes the wrong `org_id`, Supabase blocks the read
- The service role client (webhook handler) bypasses RLS — this is intentional and safe because webhook payloads come from Stripe, not from user input

### Products and prices

`products` and `prices` are Stripe catalog mirrors — they contain no user data. Their RLS policy allows any authenticated user to read them:

```sql
CREATE POLICY "authenticated_read_active_products"
  ON products FOR SELECT TO authenticated
  USING (active = true);
```

This powers the pricing table: the server component reads plan data without needing org context.

### Webhook events

The `webhook_events` table has **no RLS policies**. It is only written to by the service role client (webhook handler) and only read by server-side admin tooling. Regular users have no path to this table.

---

## Schema design decisions

### Why mirror Stripe products/prices?

Storing products and prices in Supabase means the pricing table UI can render without a Stripe API call on every page load. It also means the UI keeps working if Stripe has an outage. The `syncProductsAndPrices()` function in `src/lib/stripe/prices.ts` is called from the seed script to populate the mirror initially, and can be called from a webhook handler on `product.updated` / `price.updated` to keep it current.

### Why a separate `customers` table?

Supabase users and Stripe customers are not 1:1 — a single Stripe customer can have multiple subscriptions, and a user can belong to multiple organizations (each with their own Stripe customer). The `customers` table is the mapping layer: `org_id → stripe_customer_id`. This keeps the Stripe customer ID out of the `organizations` table and makes the relationship explicit.

### Why `organizations` instead of per-user billing?

SaaS products almost always evolve from individual to team billing. Starting with organizations (even for solo users — an org with one member) avoids a painful schema migration later. The `organization_members` table is already in place for when team management is added.

### Why `invoice_status` and `subscription_status` as enums?

PostgreSQL enums are stricter than `text` columns — they reject any value not in the defined set at the DB level. This catches bugs where code tries to write a misspelled status, rather than silently creating invalid rows. The downside is that adding a new status requires a migration (`ALTER TYPE ... ADD VALUE`), which is acceptable for a billing domain where the set of valid statuses is defined by Stripe and rarely changes.

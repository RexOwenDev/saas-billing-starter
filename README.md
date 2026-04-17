# Stripe SaaS Billing Starter

![Hero](docs/hero.png)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=nextdotjs)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
[![Stripe](https://img.shields.io/badge/Stripe-2025--01--27-635bff?logo=stripe)](https://stripe.com)
[![Supabase](https://img.shields.io/badge/Supabase-SSR-3ecf8e?logo=supabase)](https://supabase.com)
[![Vercel](https://img.shields.io/badge/Vercel-deploy-black?logo=vercel)](https://vercel.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

Production-grade SaaS billing scaffold. Drop it into any Next.js 16 project to get subscription management, metered usage, Stripe webhooks with idempotency, and a billing portal — all wired to Supabase with full Row-Level Security.

> **Portfolio showcase.** The API layer, webhook handler, and billing utilities are fully implemented production patterns — no credentials are committed and no live billing traffic is generated. The UI pages use clearly annotated stub data to illustrate the integration points your application would wire up. Add real Stripe/Supabase credentials and connect the stub data calls to run it live.

---

## What's inside

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) · React 19 · TypeScript strict |
| Billing | Stripe (`2025-01-27.acacia`) — subscriptions, metered usage, customer portal, webhooks |
| Database | Supabase · PostgreSQL · Row-Level Security |
| Auth | `@supabase/ssr` cookie-based — works in Server Components, Edge, and Node |
| UI | Tailwind v4 · shadcn/ui (new-york theme) |
| Testing | Vitest — webhook signature verification |
| Deployment | Vercel (Edge + Node runtime split) |

---

## 30-second pitch

Most SaaS billing tutorials stop at "call `stripe.subscriptions.create`." This starter goes further:

- **Webhook idempotency** — a `webhook_events` table with `UNIQUE(stripe_event_id)` prevents double-billing on Stripe retries
- **Never return 5xx to Stripe** — all errors are caught, logged, and answered with `200` after the idempotency check passes
- **Service role separation** — webhook handlers use `SUPABASE_SERVICE_ROLE_KEY` (bypasses RLS); UI and API routes use the anon key with the user's session
- **Raw body preservation** — `export const runtime = "nodejs"` on the webhook route ensures `request.text()` returns the unmodified body for HMAC verification
- **`import "server-only"`** on every Stripe library file — build-time enforcement that `STRIPE_SECRET_KEY` never reaches the client bundle
- **Discriminated union event routing** — `HandledStripeEvent` gives exhaustive compile-time coverage of all 17 handled event types

---

## Feature tiers

| Feature | Free | Pro | Enterprise |
|---|---|---|---|
| API calls / month | 1,000 | 50,000 | Unlimited |
| Storage | 1 GB | 50 GB | 1 TB |
| Team members | 1 | 10 | Unlimited |
| Projects | 3 | Unlimited | Unlimited |
| Custom domain | — | ✓ | ✓ |
| Advanced analytics | — | ✓ | ✓ |
| Priority support | — | — | ✓ |
| SSO / SAML | — | — | ✓ |
| Audit log | — | — | ✓ |
| Custom branding | — | — | ✓ |
| Dedicated infrastructure | — | — | ✓ |

---

## Architecture

```
Browser / Client
  └── Next.js App Router UI
        └── React Hooks (useSubscription, useUsage)
                        │ fetch
Next.js Server (Vercel)
  ├── Middleware ─────────────── Supabase session refresh (cookie-based)
  ├── Server Components ──────── billing page, pricing page (getPlanTier)
  ├── API Routes (/api/billing/*) ── checkout, portal, subscription, usage
  └── Webhook Handler (/api/webhooks/stripe)
        ├── HMAC signature verify (stripe.webhooks.constructEvent)
        ├── Idempotency check (webhook_events table)
        ├── routeEvent() — exhaustive discriminated union switch
        └── service_role Supabase client (bypasses RLS)

Stripe                          Supabase
  ├── Checkout Sessions           ├── PostgreSQL + RLS
  ├── Customer Portal             ├── organizations, customers
  └── Webhook Events              ├── subscriptions, usage_records
                                  ├── invoices
                                  └── webhook_events (idempotency)
```

See [`docs/architecture.md`](docs/architecture.md) for the full write-up, and [`docs/diagrams/`](docs/diagrams/) for SVG renders of each flow.

---

## Database schema

Seven migrations build the full schema progressively:

| Migration | Tables |
|---|---|
| `001_organizations` | `organizations`, `organization_members` |
| `002_customers` | `customers` (maps `org_id` → `stripe_customer_id`) |
| `003_products` | `products`, `prices` (Stripe catalog mirror) |
| `004_subscriptions` | `subscriptions` + `one_active_subscription_per_org` constraint |
| `005_usage_records` | `usage_records` + idempotency index |
| `006_webhook_events` | `webhook_events` + `UNIQUE(stripe_event_id)` |
| `007_invoices` | `invoices` |

Every table has an `updated_at` trigger, RLS policies for tenant isolation, and service-role-only write paths for webhook events. See [`docs/billing-concepts.md`](docs/billing-concepts.md) for design rationale.

---

## Quick start

### Prerequisites

- Node.js 20+
- A Stripe account (test mode keys)
- A Supabase project
- Stripe CLI (for local webhook forwarding)

### 1 — Clone and install

```bash
git clone https://github.com/RexOwenDev/saas-billing-starter.git
cd saas-billing-starter
npm install
```

### 2 — Configure environment

```bash
cp .env.example .env.local
# Edit .env.local — fill in Stripe and Supabase keys
```

See [`SETUP.md`](SETUP.md) for the full variable reference and where to find each value.

### 3 — Apply database migrations

```bash
npx supabase db push
# or, against a local Supabase instance:
npx supabase start
npx supabase db reset
```

### 4 — Seed Stripe products

```bash
npm run seed:stripe
# Idempotent — safe to run multiple times.
# Outputs STRIPE_*_PRICE_ID values to copy into .env.local
```

### 5 — Forward webhooks locally

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
# Copy the webhook signing secret into STRIPE_WEBHOOK_SECRET
```

### 6 — Run the dev server

```bash
npm run dev
# http://localhost:3000
```

### 7 — Run tests

```bash
npm test
# Vitest: webhook signature verification suite
```

---

## Project structure

```
saas-billing-starter/
├── src/
│   ├── app/
│   │   ├── (marketing)/pricing/     # Public pricing page
│   │   ├── (app)/billing/           # Authenticated billing dashboard
│   │   └── api/
│   │       ├── billing/             # checkout, portal, subscription, usage
│   │       └── webhooks/stripe/     # Stripe webhook handler
│   ├── components/billing/          # PricingTable, UsageMeter, InvoiceList…
│   ├── hooks/                       # useSubscription, useUsage
│   ├── lib/
│   │   ├── billing/                 # limits, periods, proration, features
│   │   ├── stripe/                  # client, checkout, portal, webhooks, handlers/
│   │   └── supabase/                # browser, server, middleware clients
│   ├── middleware.ts                 # Session refresh on every request
│   └── types/                       # database, stripe, billing type definitions
├── supabase/
│   ├── migrations/                  # 001–007 SQL migrations
│   └── seed.sql                     # Demo products + prices
├── tests/
│   ├── fixtures/stripe-events/      # JSON event fixtures for tests
│   └── webhook.test.ts              # Signature verification tests
├── scripts/
│   ├── seed-stripe-products.ts      # Idempotent Stripe product seeder
│   ├── generate-hero.mjs            # Gemini Imagen 4.0 hero image
│   └── generate-diagrams.ts         # Mermaid CLI diagram generator
└── docs/
    ├── architecture.md
    ├── stripe-events.md
    ├── billing-concepts.md
    └── diagrams/                    # SVG renders
```

---

## Key implementation patterns

### Webhook idempotency

Stripe retries webhooks on non-2xx responses. Without idempotency, a temporary DB error during event processing can cause the same subscription event to be handled twice — doubling a charge or creating orphan records.

This starter prevents that with a `webhook_events` table:

```sql
CREATE UNIQUE INDEX webhook_events_stripe_event_id_idx
  ON webhook_events (stripe_event_id);
```

The handler checks this before processing:

```
1. Verify HMAC signature → 400 on fail (only safe non-200)
2. Query webhook_events WHERE stripe_event_id = ?
   - "succeeded" → 200 (duplicate)
   - "processing" → 200 (concurrent delivery)
   - not found   → INSERT status=processing, then handle
3. Handle event, UPDATE status=succeeded
4. On any error: UPDATE status=failed, return 200
```

See [`docs/stripe-events.md`](docs/stripe-events.md) for the full event catalog and handling strategy.

### Plan tier gate (server-side)

```typescript
// In any Server Component or API route:
import { getPlanTier } from "@/lib/stripe/subscriptions";

const tier = await getPlanTier(orgId); // "free" | "pro" | "enterprise"

if (!planIncludes(tier, "pro")) {
  redirect("/billing?upgrade=true");
}
```

### Metered usage reporting

```typescript
import { reportUsage } from "@/lib/stripe/metering";

await reportUsage({
  orgId,
  feature: "api_calls",
  quantity: 1,
  idempotencyKey: `req_${requestId}`,
});
```

`reportUsage` checks the local `usage_records` table for the idempotency key before calling the Stripe Meters API — preventing double-counting on retries.

---

## Environment variables

| Variable | Required | Description |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✓ | `sk_test_…` from Stripe Dashboard |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✓ | `pk_test_…` |
| `STRIPE_WEBHOOK_SECRET` | ✓ | `whsec_…` from `stripe listen` output |
| `STRIPE_FREE_MONTHLY_PRICE_ID` | ✓ | Output of `npm run seed:stripe` |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | ✓ | Output of `npm run seed:stripe` |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | ✓ | Output of `npm run seed:stripe` |
| `STRIPE_ENTERPRISE_MONTHLY_PRICE_ID` | ✓ | Output of `npm run seed:stripe` |
| `STRIPE_ENTERPRISE_ANNUAL_PRICE_ID` | ✓ | Output of `npm run seed:stripe` |
| `STRIPE_API_CALLS_PRICE_ID` | ✓ | Metered price from `npm run seed:stripe` |
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | Service role key (server-only, never public) |
| `NEXT_PUBLIC_APP_URL` | ✓ | `http://localhost:3000` in dev |

See [`SETUP.md`](SETUP.md) for where to find each value.

---

## FAQ

<details>
<summary>Why does the webhook route have <code>export const runtime = "nodejs"</code>?</summary>

Stripe HMAC verification requires the raw request body as a string — before any JSON parsing. Next.js Edge Runtime may not expose `request.text()` reliably for HMAC. Setting `runtime = "nodejs"` pins the route to the Node.js runtime where `request.text()` always returns the unmodified payload.

</details>

<details>
<summary>Why use <code>SUPABASE_SERVICE_ROLE_KEY</code> in the webhook handler?</summary>

The webhook handler runs outside of any user session — it is a server-to-server call from Stripe. RLS policies check `auth.uid()` from the session JWT. Since there is no user session, the anon client cannot pass RLS. The service role client bypasses RLS entirely and is only used in server-side paths where no user input is involved.

</details>

<details>
<summary>What happens if the webhook handler throws an error?</summary>

After the idempotency check and `INSERT` into `webhook_events`, all processing runs inside a `try/catch`. On error the handler updates `webhook_events.status = 'failed'` and still returns `200 OK`. This prevents Stripe from retrying indefinitely for bugs that will not self-resolve. Failed events can be inspected in the `webhook_events` table and replayed once the bug is fixed.

</details>

<details>
<summary>How do I add a new plan tier?</summary>

1. Add the tier to `PlanTier` in `src/types/billing.ts`
2. Add an entry to `PLAN_CONFIGS` with features and limits
3. Create a new product + price in Stripe (or add to `scripts/seed-stripe-products.ts`)
4. Add the new `STRIPE_*_PRICE_ID` env var
5. Update `getPriceIdForPlan()` in `src/lib/stripe/checkout.ts`

</details>

<details>
<summary>How do I add a new metered event type?</summary>

1. Add the event name to `METERED_EVENTS` in `src/types/billing.ts`
2. Add it to the `metered_event` CHECK constraint in `supabase/migrations/005_usage_records.sql`
3. Call `reportUsage({ feature: "your_event", ... })` wherever usage should be tracked
4. Create a metered Stripe price and add the price ID env var
5. Update `PLAN_CONFIGS.features` with the new limit field

</details>

<details>
<summary>Can I use this with Prisma instead of Supabase?</summary>

The billing logic in `src/lib/stripe/` is database-agnostic. The only Supabase-specific code is in `src/lib/supabase/` (client factories) and `src/app/api/` (auth checks). Replacing Supabase with Prisma requires swapping those two layers; the Stripe integration, types, and UI components are unchanged.

</details>

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, feature requests, and pull requests are welcome.

## Security

See [SECURITY.md](SECURITY.md) for how to report vulnerabilities.

## License

MIT — see [LICENSE](LICENSE).

---

Built by [RexOwenDev](https://github.com/RexOwenDev) · Powered by [Next.js](https://nextjs.org), [Stripe](https://stripe.com), [Supabase](https://supabase.com)

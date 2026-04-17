# Architecture

Deep-dive into every layer of the Stripe SaaS Billing Starter.

---

## Runtime split: Edge vs Node

Next.js 16 on Vercel runs routes in two runtimes:

| Runtime | Used for | Constraint |
|---|---|---|
| **Edge** (default) | Middleware, most API routes | No native Node.js modules |
| **Node.js** | Webhook handler | Required for raw body access |

The webhook route at `src/app/api/webhooks/stripe/route.ts` explicitly sets:

```typescript
export const runtime = "nodejs";
```

This is non-negotiable: Stripe's HMAC verification requires `request.text()` to return the raw, unmodified request body before any JSON parsing. Edge Runtime's body buffering can modify the stream and break the signature check.

Every other API route (`/api/billing/*`) runs on the default Edge Runtime — faster cold starts and global distribution.

---

## Next.js App Router layers

```
src/app/
├── (marketing)/           # Route group — no auth required
│   └── pricing/           # Public pricing page — Server Component
│       └── page.tsx
└── (app)/                 # Route group — auth required
    └── billing/           # Billing dashboard — Server Component
        └── page.tsx
```

Route groups (`(marketing)` and `(app)`) share no layout files and apply no auth logic themselves — auth is handled in middleware. The group names do not appear in URLs.

Server Components in `(app)` call `getPlanTier()` directly (a server-side function hitting Supabase) to render the correct UI tier without a client-side fetch round trip.

---

## Supabase client strategy

Three distinct clients are used, each for a different trust context:

### 1 — Browser client (`src/lib/supabase/client.ts`)

```typescript
createBrowserClient<Database>(url, anonKey)
```

Used in React Client Components (`"use client"`). Manages the user's session from cookies set by the SSR client. **Anon key only** — all data access is subject to RLS.

### 2 — Server client (`src/lib/supabase/server.ts` → `createClient()`)

```typescript
createServerClient<Database>(url, anonKey, { cookies: ... })
```

Used in Server Components and API routes with a user session. Reads `auth.uid()` from the session cookie to satisfy RLS. The anon key keeps permissions narrow.

### 3 — Service role client (`src/lib/supabase/server.ts` → `createServiceClient()`)

```typescript
createServerClient<Database>(url, serviceRoleKey, { cookies: { getAll: () => [], setAll: () => {} } })
```

**Bypasses RLS entirely.** Used exclusively in:
- `src/app/api/webhooks/stripe/route.ts` (no user session available)
- Any server-side admin operation that must write across tenant boundaries

The empty cookie callbacks are intentional: the service role client has no concept of a user session and should never try to read or set cookies.

---

## Stripe integration architecture

```
src/lib/stripe/
├── client.ts          # Singleton: import "server-only" + Stripe constructor
├── customer.ts        # createOrGetCustomer — idempotent Supabase-first lookup
├── checkout.ts        # createCheckoutSession — trial, idempotency, price mapping
├── portal.ts          # createPortalSession — return URL
├── subscriptions.ts   # read/update subscription state
├── metering.ts        # reportUsage — local idempotency + Stripe Meters API
├── invoices.ts        # list / upcoming invoice
├── prices.ts          # syncProductsAndPrices — catalog mirror
├── webhook.ts         # verifyWebhookSignature + isHandledEventType
├── index.ts           # barrel
└── handlers/
    ├── subscription.ts
    ├── invoice.ts
    ├── checkout.ts
    ├── customer.ts
    └── portal.ts
```

### `import "server-only"` enforcement

Every file in `src/lib/stripe/` has `import "server-only"` at the top. This is a Next.js compile-time enforcement mechanism: if any of these files is accidentally imported in a Client Component (`"use client"`), the build fails with a clear error. This guarantees `STRIPE_SECRET_KEY` never reaches the browser bundle.

### Customer idempotency

`createOrGetCustomer()` checks `customers` in Supabase before calling `stripe.customers.create`. This prevents orphan Stripe customers when the user clicks "checkout" twice before the first request completes.

---

## Webhook handler state machine

The handler at `src/app/api/webhooks/stripe/route.ts` implements a five-state machine per event:

```
[incoming] → verify_signature → idempotency_check → processing → succeeded
                    │                   │                 │
                  400 Bad            200 Skip          failed (still 200)
                  Request        (duplicate/concurrent)
```

### Why never return 5xx?

Stripe retries any non-2xx response. If a transient DB error causes a 500, Stripe retries the event — but the DB write may have already partially completed, leading to duplicate processing.

The contract: **return 200 once you have inserted the idempotency row.** If processing fails, mark the row `failed` and return 200. Failed events are visible in the `webhook_events` table for manual replay after the bug is fixed.

### The one legitimate 400

Signature verification failure (`400 Bad Request`) is intentional and safe. A bad signature means:
1. The request is not from Stripe, or
2. The raw body was modified in transit

In either case, there is nothing valid to process. The 400 tells Stripe (if it genuinely sent the request) that something is wrong, and the retry will also fail — which surfaces the issue quickly. No idempotency row is written at this stage.

---

## Security decisions

### CSP header

`next.config.ts` sets a strict Content Security Policy:

```
default-src 'self';
script-src 'self' 'nonce-{nonce}' https://js.stripe.com;
connect-src 'self' https://api.stripe.com https://*.supabase.co;
frame-src https://js.stripe.com https://hooks.stripe.com;
```

`js.stripe.com` is whitelisted for Stripe.js (used by Stripe Elements in checkout). No `unsafe-inline` or `unsafe-eval`.

### Cookie security

`src/lib/supabase/middleware.ts` wraps all cookie set-calls through `safeCookieOptions()`:

```typescript
function safeCookieOptions(options?: CookieOptions): CookieOptions {
  const base = { ...options };
  const sameSite = (base.sameSite ?? "lax").toString().toLowerCase();
  if (sameSite === "none") {
    base.sameSite = "lax";
  }
  return base;
}
```

This downgrades any `SameSite=None` to `Lax` — preventing cross-site cookie abuse while keeping Supabase auth working in iframes-free flows. The original in-memory state update (for Next.js SSR) uses the raw options but never reaches the browser.

### `noUncheckedIndexedAccess`

`tsconfig.json` has `"noUncheckedIndexedAccess": true` alongside `strict: true`. Array and object index access returns `T | undefined` instead of `T`, eliminating a whole class of runtime crashes from off-by-one errors and missing keys in webhook payloads.

---

## Data flow: checkout to active subscription

```
1. User clicks "Upgrade to Pro"
   └── POST /api/billing/checkout
         ├── Auth check (Supabase session)
         ├── createOrGetCustomer(orgId) → customers table + Stripe
         ├── createCheckoutSession(customerId, priceId, trial=14days)
         └── redirect to Stripe-hosted checkout URL

2. User completes payment on Stripe
   └── Stripe sends checkout.session.completed webhook
         ├── verifyWebhookSignature (HMAC)
         ├── Idempotency check (webhook_events)
         ├── handleCheckoutSessionCompleted
         │     └── upsert customers.stripe_customer_id
         └── 200 OK

3. Stripe creates subscription
   └── Stripe sends customer.subscription.created webhook
         ├── handleSubscriptionCreated
         │     └── upsert subscriptions row (status=trialing or active)
         └── 200 OK

4. Trial ends / payment succeeds
   └── Stripe sends invoice.payment_succeeded + customer.subscription.updated
         ├── handleInvoicePaymentSucceeded → upsert invoices
         ├── handleSubscriptionUpdated → update status=active
         └── 200 OK
```

---

## Diagram reference

All diagrams are in `docs/diagrams/` (generated by `npm run generate:diagrams`):

| File | Content |
|---|---|
| `subscription-lifecycle.svg` | State machine for all 8 subscription statuses |
| `webhook-flow.svg` | Sequence diagram of idempotent webhook processing |
| `schema.svg` | ER diagram of all 7 tables |
| `architecture.svg` | Full system architecture graph |

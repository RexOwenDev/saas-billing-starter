# Changelog

All notable changes to this project are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.7.0] — 2026-04-17

### Added — Phase 7: Docs, Diagrams & Showcase Polish

- `scripts/generate-hero.mjs` — Gemini Imagen 4.0 hero image generator; saves `docs/hero.png`
- `scripts/generate-diagrams.ts` — Mermaid CLI generator for four SVG diagrams:
  - `docs/diagrams/subscription-lifecycle.svg` — state machine for all subscription statuses
  - `docs/diagrams/webhook-flow.svg` — sequence diagram of idempotent webhook processing
  - `docs/diagrams/schema.svg` — ER diagram of all seven tables
  - `docs/diagrams/architecture.svg` — full system architecture graph
- `README.md` — full showcase README: hero image, badges, 30-sec pitch, feature tier table, architecture overview, quick-start (10 steps), project structure, key patterns, env var reference, FAQ
- `SETUP.md` — 10-step bootstrap guide with env var reference, Vercel deploy instructions
- `CHANGELOG.md` — this file
- `docs/architecture.md` — deep-dive: Next.js App Router layer split, Supabase client strategy, Stripe integration, security decisions
- `docs/stripe-events.md` — complete catalog of 17 handled Stripe events, idempotency strategy, error handling policy
- `docs/billing-concepts.md` — billing model design: plan tiers, metered usage, proration, trial handling, RLS strategy

---

## [0.6.0] — 2026-04-17

### Added — Phase 6: Usage Metering Skeleton

- `src/lib/billing/limits.ts` — `getLimitForFeature`, `isOverLimit`, `getUsagePercent`, `getRemainingUsage`, `checkAllLimits`
- `src/lib/billing/periods.ts` — `getBillingPeriod`, `daysUntilRenewal`, `isWithinPeriod`, `isTrialing`, `trialDaysRemaining`, `formatPeriod`
- `src/lib/billing/proration.ts` — `estimateProration` (unused credit + new plan charge), `dailyRate`
- `src/lib/billing/features.ts` — `getPlanFeatures`, `hasFeature`, `getFeatureLimit`, `planIncludes`, `minimumPlanForFeature`
- `src/lib/billing/index.ts` — barrel export for all billing utilities
- `src/hooks/use-subscription.ts` — `useSubscription()` React hook; `useHasPlanAccess()` tier guard
- `src/hooks/use-usage.ts` — `useUsage()` React hook fetching `/api/billing/usage`
- `src/middleware.ts` — Next.js middleware calling `updateSession()`, matcher excludes static assets

---

## [0.5.0] — 2026-04-17

### Added — Phase 5: UI Layer

- `src/components/billing/plan-badge.tsx` — `PlanBadge` with tier-to-variant colour mapping
- `src/components/billing/feature-list.tsx` — `FeatureList` with check/cross icons, number/boolean formatters
- `src/components/billing/pricing-card.tsx` — `PricingCard` with annual savings %, CTA posts to `/api/billing/checkout`
- `src/components/billing/pricing-table.tsx` — `PricingTable` with monthly/annual interval toggle
- `src/components/billing/subscription-status.tsx` — status display with `past_due` and cancellation alerts
- `src/components/billing/usage-meter.tsx` — progress bar with near-limit (80%) and at-limit (100%) colour states
- `src/components/billing/invoice-list.tsx` — invoice table with hosted URL and PDF download links
- `src/app/(marketing)/pricing/page.tsx` — Server Component pricing page with FAQ accordion
- `src/app/(app)/billing/page.tsx` — authenticated billing dashboard with usage meters, portal buttons, invoice list

---

## [0.4.0] — 2026-04-17

### Added — Phase 4: Webhook Architecture

- `src/app/api/webhooks/stripe/route.ts` — main webhook handler: HMAC verify, idempotency state machine, exhaustive event routing, never-5xx policy
- `src/lib/stripe/webhook.ts` — `verifyWebhookSignature`, `isHandledEventType` with `ReadonlySet` of 17 handled types
- `src/lib/stripe/handlers/subscription.ts` — subscription created/updated/deleted/trial-will-end/paused/resumed
- `src/lib/stripe/handlers/invoice.ts` — invoice payment-succeeded/failed/finalized/upcoming
- `src/lib/stripe/handlers/checkout.ts` — checkout session completed/expired
- `src/lib/stripe/handlers/customer.ts` — customer created/updated/deleted
- `src/lib/stripe/handlers/portal.ts` — billing portal configuration/session events
- `tests/fixtures/stripe-events/subscription.created.json` — test fixture
- `tests/fixtures/stripe-events/invoice.payment_succeeded.json` — test fixture
- `tests/fixtures/stripe-events/checkout.session.completed.json` — test fixture
- `tests/webhook.test.ts` — Vitest: signature verification (valid, wrong secret, old timestamp, tampered body)
- `src/app/api/billing/checkout/route.ts` — POST with Zod validation, auth check, 14-day trial, idempotency key
- `src/app/api/billing/portal/route.ts` — GET creating portal session + redirect

---

## [0.3.0] — 2026-04-17

### Added — Phase 3: Stripe Integration Layer

- `src/lib/stripe/client.ts` — Stripe singleton with `import "server-only"`, `2025-01-27.acacia` API version
- `src/lib/stripe/customer.ts` — `createOrGetCustomer` (idempotent), `getCustomerByStripeId`, `getCustomerByOrgId`
- `src/lib/stripe/checkout.ts` — `createCheckoutSession`, `createUpgradeSession`, `getPriceIdForPlan`
- `src/lib/stripe/portal.ts` — `createPortalSession`
- `src/lib/stripe/subscriptions.ts` — `getSubscription`, `getPlanTier`, `cancelSubscription`, `resumeSubscription`, `changePlan`, `getStripeSubscription`, `normalizeSubscriptionStatus`
- `src/lib/stripe/metering.ts` — `reportUsage` with local idempotency check; `getUsageSummary`
- `src/lib/stripe/invoices.ts` — `listInvoices`, `getUpcomingInvoice`, `formatInvoiceAmount`
- `src/lib/stripe/prices.ts` — `syncProductsAndPrices`, `getActivePrices`
- `src/lib/stripe/index.ts` — barrel export
- `scripts/seed-stripe-products.ts` — idempotent Stripe product/price seeder with live-key guard

---

## [0.2.0] — 2026-04-17

### Added — Phase 2: Type System & Supabase Clients

- `src/types/database.ts` — full DB type definitions for all 9 tables
- `src/types/stripe.ts` — `HandledStripeEventType` union (17 types), discriminated union `HandledStripeEvent`, type guard helpers
- `src/types/billing.ts` — `PlanTier`, `BillingInterval`, `PlanFeatures`, `PLAN_CONFIGS` (free/pro/enterprise), `METERED_EVENTS`, `SubscriptionState`
- `src/lib/supabase/client.ts` — browser client factory
- `src/lib/supabase/server.ts` — `createClient()` (cookie-based SSR) + `createServiceClient()` (service role, webhook use)
- `src/lib/supabase/middleware.ts` — `updateSession()` with `safeCookieOptions()` enforcing SameSite ≥ lax

---

## [0.1.0] — 2026-04-17

### Added — Phase 0 & 1: Foundation

- `create-next-app` scaffold: Next.js 16, TypeScript strict, Tailwind v4, App Router
- `tsconfig.json` — `noUncheckedIndexedAccess: true` added alongside `strict: true`
- `next.config.ts` — security headers: CSP, X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- `package.json` — scripts: `type-check`, `seed:stripe`, `generate:hero`, `generate:diagrams`, `generate:all`
- `.env.example` — all 14 env vars documented with descriptions
- `supabase/migrations/001_organizations.sql` — organizations, organization_members, update_updated_at trigger
- `supabase/migrations/002_customers.sql` — customers table
- `supabase/migrations/003_products.sql` — products, prices
- `supabase/migrations/004_subscriptions.sql` — subscriptions, one_active_subscription_per_org constraint
- `supabase/migrations/005_usage_records.sql` — usage_records, idempotency index
- `supabase/migrations/006_webhook_events.sql` — webhook_events, UNIQUE(stripe_event_id)
- `supabase/migrations/007_invoices.sql` — invoices
- `supabase/seed.sql` — demo products (free/pro/enterprise) and 6 prices
- GitHub repo: [RexOwenDev/saas-billing-starter](https://github.com/RexOwenDev/saas-billing-starter)

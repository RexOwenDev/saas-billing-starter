# Setup Guide

Complete walkthrough from zero to a running local dev environment.

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 20+ | `node --version` |
| npm | 10+ | ships with Node 20 |
| Stripe CLI | latest | `brew install stripe/stripe-cli/stripe` |
| Supabase CLI | latest | `npm install -g supabase` |
| Git | any | |

---

## Step 1 — Clone

```bash
git clone https://github.com/RexOwenDev/saas-billing-starter.git
cd saas-billing-starter
npm install
```

---

## Step 2 — Stripe account setup

1. Create a free account at [dashboard.stripe.com](https://dashboard.stripe.com)
2. Make sure you are in **Test mode** (toggle in the top-left)
3. Go to **Developers → API keys**
4. Copy the **Publishable key** (`pk_test_…`) and **Secret key** (`sk_test_…`)
5. Go to **Developers → Webhooks → Add local listener** (or use the CLI in Step 5)

---

## Step 3 — Supabase project setup

1. Create a project at [supabase.com/dashboard](https://supabase.com/dashboard)
2. Go to **Project Settings → API**
3. Copy:
   - **Project URL** (`https://<ref>.supabase.co`)
   - **Anon / public key** (`eyJ…` — safe to expose in the browser)
   - **Service role key** (`eyJ…` — **never expose to the browser**)

---

## Step 4 — Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

```bash
# ── Stripe ──────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # filled in Step 5

# ── Stripe Price IDs (filled in Step 6) ─────────────────────────────────────
STRIPE_FREE_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_...
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=price_...
STRIPE_API_CALLS_PRICE_ID=price_...

# ── Supabase ─────────────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...       # server-only, never prefix with NEXT_PUBLIC_

# ── App ──────────────────────────────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Step 5 — Apply Supabase migrations

### Option A — Against your cloud project

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

### Option B — Local Supabase (Docker required)

```bash
npx supabase start
# Starts a local Supabase instance at http://localhost:54323
npx supabase db reset
# Applies all migrations + seed.sql
```

After `supabase start`, use the printed `anon key` and `service_role key` as your `.env.local` values (URL will be `http://localhost:54321`).

---

## Step 6 — Seed Stripe products and prices

```bash
STRIPE_SECRET_KEY=sk_test_... npm run seed:stripe
```

The seeder creates three products (Free, Pro, Enterprise) and six prices (monthly + annual for Pro/Enterprise, plus a metered API calls price). It prints the price IDs at the end:

```
STRIPE_FREE_MONTHLY_PRICE_ID=price_1AbC...
STRIPE_PRO_MONTHLY_PRICE_ID=price_2DeF...
STRIPE_PRO_ANNUAL_PRICE_ID=price_3GhI...
STRIPE_ENTERPRISE_MONTHLY_PRICE_ID=price_4JkL...
STRIPE_ENTERPRISE_ANNUAL_PRICE_ID=price_5MnO...
STRIPE_API_CALLS_PRICE_ID=price_6PqR...
```

Copy these into `.env.local`.

The seeder is **idempotent** — it uses `metadata.tier` and Stripe price `lookup_key` to find or create, so running it again is safe.

---

## Step 7 — Forward webhooks locally

In a separate terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Stripe CLI prints a webhook signing secret (`whsec_…`). Copy it into `.env.local`:

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## Step 8 — Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

- `/pricing` — public pricing table with plan comparison
- `/billing` — billing dashboard (requires auth)

---

## Step 9 — Run type-check and tests

```bash
npm run type-check   # tsc --noEmit
npm test             # Vitest — webhook signature tests
```

Both should pass with zero errors before opening a PR.

---

## Step 10 — (Optional) Generate docs assets

```bash
# Hero image — requires GEMINI_API_KEY with Imagen 4.0 access
GEMINI_API_KEY=... npm run generate:hero

# Architecture diagrams — requires @mermaid-js/mermaid-cli
npm install -D @mermaid-js/mermaid-cli
npm run generate:diagrams

# Both at once
npm run generate:all
```

---

## Deploying to Vercel

1. Push to GitHub
2. Import the repo at [vercel.com/new](https://vercel.com/new)
3. Add all `.env.local` variables as **Environment Variables** in the Vercel dashboard
4. For the webhook secret: go to Stripe Dashboard → **Webhooks → Add endpoint**, set the URL to `https://your-domain.vercel.app/api/webhooks/stripe`, select all events, and copy the signing secret
5. Redeploy after adding env vars

---

## Environment variable reference

| Variable | Where to find it | Exposed to browser? |
|---|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys | No |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → Developers → API keys | Yes |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output or Stripe Dashboard → Webhooks | No |
| `STRIPE_*_PRICE_ID` | Output of `npm run seed:stripe` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API | **No — never** |
| `NEXT_PUBLIC_APP_URL` | Your domain | Yes |

> **Important:** `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row-Level Security. Never prefix it with `NEXT_PUBLIC_` and never log or expose it in API responses.

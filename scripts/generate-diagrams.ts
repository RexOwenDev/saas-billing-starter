#!/usr/bin/env tsx
/**
 * Generates architecture and flow diagrams as SVG files using Mermaid CLI.
 *
 * Usage:
 *   npm run generate:diagrams
 *   # requires: npm install -D @mermaid-js/mermaid-cli
 *
 * Output files (docs/diagrams/):
 *   subscription-lifecycle.svg
 *   webhook-flow.svg
 *   schema.svg
 *   architecture.svg
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

const ROOT = join(__dirname, "..");
const OUT_DIR = join(ROOT, "docs", "diagrams");

mkdirSync(OUT_DIR, { recursive: true });

interface Diagram {
  name: string;
  definition: string;
}

const DIAGRAMS: Diagram[] = [
  {
    name: "subscription-lifecycle",
    definition: `
stateDiagram-v2
    [*] --> incomplete : checkout.session.completed
    incomplete --> active : invoice.payment_succeeded
    incomplete --> incomplete_expired : payment never made
    active --> past_due : invoice payment failed
    past_due --> active : payment retried & succeeded
    past_due --> canceled : max retries exceeded
    active --> trialing : trial started
    trialing --> active : trial ends, payment succeeds
    trialing --> canceled : trial ends, no payment
    active --> paused : subscription.paused
    paused --> active : subscription.resumed
    active --> canceled : customer cancels
    canceled --> [*]
    incomplete_expired --> [*]
`,
  },
  {
    name: "webhook-flow",
    definition: `
sequenceDiagram
    participant S as Stripe
    participant W as /api/webhooks/stripe
    participant DB as Supabase (service role)
    participant H as Event Handler

    S->>W: POST stripe-signature header + raw body
    W->>W: stripe.webhooks.constructEvent() HMAC verify
    alt signature invalid
        W-->>S: 400 Bad Request
    end
    W->>DB: SELECT webhook_events WHERE stripe_event_id
    alt already succeeded
        W-->>S: 200 OK (duplicate, skip)
    else processing (concurrent)
        W-->>S: 200 OK (concurrent, skip)
    else not found
        W->>DB: INSERT webhook_events (status=processing)
        W->>H: routeEvent(event) exhaustive switch
        H->>DB: upsert subscription / invoice / customer
        W->>DB: UPDATE webhook_events (status=succeeded)
        W-->>S: 200 OK
    end
    note over W: Errors are caught -- never return 5xx to Stripe
`,
  },
  {
    name: "schema",
    definition: `
erDiagram
    organizations ||--o{ organization_members : "has"
    organizations ||--o| customers : "has"
    organizations ||--o{ subscriptions : "has"
    organizations ||--o{ usage_records : "records"
    organizations ||--o{ invoices : "has"
    customers ||--o{ subscriptions : "billing via"
    products ||--o{ prices : "has"
    prices ||--o{ subscriptions : "used in"

    organizations {
        uuid id PK
        text name
        text slug UK
        timestamptz created_at
    }
    customers {
        uuid id PK
        uuid org_id FK
        text stripe_customer_id UK
    }
    subscriptions {
        uuid id PK
        uuid org_id FK
        text stripe_subscription_id UK
        text status
        text stripe_price_id FK
        timestamptz current_period_start
        timestamptz current_period_end
    }
    usage_records {
        uuid id PK
        uuid org_id FK
        text feature
        integer quantity
        text idempotency_key UK
    }
    webhook_events {
        uuid id PK
        text stripe_event_id UK
        text event_type
        text status
        jsonb payload
    }
`,
  },
  {
    name: "architecture",
    definition: `
graph TB
    subgraph Client["Browser / Client"]
        UI["Next.js App Router UI"]
        Hooks["React Hooks<br/>useSubscription, useUsage"]
    end

    subgraph Server["Next.js Server (Vercel)"]
        MW["Middleware - Supabase session refresh"]
        Pages["Server Components<br/>billing, pricing pages"]
        API["API Routes<br/>/api/billing/*"]
        WHK["Webhook Handler<br/>/api/webhooks/stripe"]
    end

    subgraph Stripe["Stripe"]
        Portal["Customer Portal"]
        Checkout["Checkout Sessions"]
        Events["Webhook Events"]
    end

    subgraph Supabase["Supabase"]
        Auth["Auth SSR cookies"]
        DB["PostgreSQL + RLS"]
        SVC["service_role client<br/>webhook writes"]
    end

    UI --> MW
    Hooks -->|fetch| API
    API -->|anon client| Auth
    API -->|create session| Checkout
    API -->|create session| Portal
    Pages -->|getPlanTier| DB
    WHK -->|constructEvent| Events
    WHK -->|service role| SVC
    SVC --> DB
    Events -->|POST| WHK
`,
  },
];

function renderDiagram(diagram: Diagram): void {
  const tmpInput = join(tmpdir(), `${randomUUID()}.mmd`);
  const outputPath = join(OUT_DIR, `${diagram.name}.svg`);

  writeFileSync(tmpInput, diagram.definition.trim());

  // execFileSync avoids shell spawning — args are passed directly to the process
  execFileSync(
    "npx",
    [
      "--yes",
      "@mermaid-js/mermaid-cli",
      "mmdc",
      "-i", tmpInput,
      "-o", outputPath,
      "--backgroundColor", "transparent",
      "--theme", "neutral",
    ],
    { stdio: "inherit" }
  );
  console.log(`✓ ${diagram.name}.svg`);
}

console.log("→ Generating Mermaid diagrams…\n");
for (const diagram of DIAGRAMS) {
  renderDiagram(diagram);
}
console.log(`\n✓ All diagrams saved to docs/diagrams/`);

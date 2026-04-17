import type { Metadata } from "next";
import { PricingTable } from "@/components/billing/pricing-table";

export const metadata: Metadata = {
  title: "Pricing — SaaS Billing Starter",
  description:
    "Simple, transparent pricing. Start for free, upgrade when you need more.",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mt-4 text-xl text-muted-foreground">
            Start for free. Upgrade as you grow. No surprises.
          </p>
        </div>

        {/* Plan cards with billing interval toggle */}
        <PricingTable />

        {/* FAQ section */}
        <section className="mx-auto mt-20 max-w-2xl space-y-6">
          <h2 className="text-center text-2xl font-bold">
            Frequently asked questions
          </h2>
          <div className="space-y-4 text-sm">
            {FAQ_ITEMS.map(({ q, a }) => (
              <details key={q} className="group rounded-lg border p-4">
                <summary className="cursor-pointer font-medium group-open:mb-2">
                  {q}
                </summary>
                <p className="text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

const FAQ_ITEMS = [
  {
    q: "Can I switch plans?",
    a: "Yes — upgrade or downgrade at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period.",
  },
  {
    q: "What payment methods do you accept?",
    a: "We accept all major credit and debit cards (Visa, Mastercard, Amex, Discover) via Stripe. Enterprise plans can also pay by invoice.",
  },
  {
    q: "Is my data safe?",
    a: "Payment processing is handled entirely by Stripe — we never store card numbers. Your application data is stored in Supabase with row-level security enforcing tenant isolation.",
  },
  {
    q: "What happens when I reach my usage limit?",
    a: "We'll notify you when you reach 80% of your plan limit. If you exceed it, additional requests will be metered and billed at the overage rate, or you can upgrade your plan.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from your billing settings and your subscription stays active until the end of the current period. No refunds for partial months, but we won't charge you again.",
  },
  {
    q: "Is there a free trial?",
    a: "Pro and Enterprise plans include a 14-day free trial. No credit card required to start.",
  },
];

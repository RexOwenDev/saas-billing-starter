import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SubscriptionStatus } from "@/components/billing/subscription-status";
import { UsageMeter } from "@/components/billing/usage-meter";
import { InvoiceList } from "@/components/billing/invoice-list";
import { PLAN_CONFIGS } from "@/types/billing";
import type { SubscriptionState } from "@/types/billing";

export const metadata: Metadata = {
  title: "Billing — SaaS Billing Starter",
};

// In production: fetch from Supabase via getSubscription() + getPlanTier()
// Using stub data here so the page renders without live Stripe credentials
function getStubSubscriptionState(): SubscriptionState {
  return {
    tier: "pro",
    status: "active",
    currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
    cancelAtPeriodEnd: false,
    isTrialing: true,
    trialEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    features: PLAN_CONFIGS.pro.features,
  };
}

export default function BillingPage() {
  const state = getStubSubscriptionState();
  const plan = PLAN_CONFIGS[state.tier];

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold">Billing & Subscription</h1>
        <p className="text-muted-foreground">
          Manage your plan, payment method, and invoices.
        </p>
      </div>

      {/* Current subscription status */}
      <SubscriptionStatus state={state} />

      {/* Usage meters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usage this period</CardTitle>
          <CardDescription>
            Resets on{" "}
            {state.currentPeriodEnd.toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <UsageMeter
            label="API Calls"
            used={42_300}
            limit={plan.features.apiCallsPerMonth}
          />
          <UsageMeter
            label="Storage"
            used={12}
            limit={plan.features.storageGb}
            unit="GB"
          />
          <UsageMeter
            label="Team Members"
            used={3}
            limit={plan.features.teamMembers}
          />
          <UsageMeter
            label="Projects"
            used={7}
            limit={plan.features.projects}
          />
        </CardContent>
      </Card>

      {/* Manage plan */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manage subscription</CardTitle>
          <CardDescription>
            Update your plan, payment method, or cancel via the Stripe Customer
            Portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {/* Portal redirect — server route creates the portal session */}
          <Button asChild variant="default">
            <a href="/api/billing/portal">Manage in Stripe Portal</a>
          </Button>
          <Button asChild variant="outline">
            <a href="/pricing">View all plans</a>
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Invoice history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice history</CardTitle>
          <CardDescription>
            Download past invoices for accounting.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* In production: pass real invoices from listInvoices(orgId) */}
          <InvoiceList invoices={[]} />
        </CardContent>
      </Card>
    </div>
  );
}

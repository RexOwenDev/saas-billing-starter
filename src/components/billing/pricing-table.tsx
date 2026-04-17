"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingCard } from "./pricing-card";
import { PLAN_CONFIGS } from "@/types/billing";
import type { BillingInterval, PlanTier } from "@/types/billing";

interface PricingTableProps {
  currentTier?: PlanTier;
}

export function PricingTable({ currentTier }: PricingTableProps) {
  const [interval, setInterval] = useState<BillingInterval>("month");

  return (
    <div className="space-y-8">
      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <Tabs
          value={interval}
          onValueChange={(v) => setInterval(v as BillingInterval)}
        >
          <TabsList>
            <TabsTrigger value="month">Monthly</TabsTrigger>
            <TabsTrigger value="year">
              Annual
              <span className="ml-1.5 rounded-full bg-green-100 px-1.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Save 17%
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Plan cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {(["free", "pro", "enterprise"] as PlanTier[]).map((tier) => (
          <PricingCard
            key={tier}
            plan={PLAN_CONFIGS[tier]}
            interval={interval}
            currentTier={currentTier}
          />
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        All plans include 14-day free trial. No credit card required for Free plan.
        <br />
        Prices in USD. Cancel anytime.
      </p>
    </div>
  );
}

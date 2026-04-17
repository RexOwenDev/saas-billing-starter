"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FeatureList } from "./feature-list";
import type { PlanConfig, BillingInterval } from "@/types/billing";

interface PricingCardProps {
  plan: PlanConfig;
  interval: BillingInterval;
  currentTier?: string;
}

export function PricingCard({ plan, interval, currentTier }: PricingCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isCurrent = currentTier === plan.tier;
  const isFreePlan = plan.priceMonthly === 0;

  const displayPrice =
    interval === "month"
      ? plan.priceMonthly / 100
      : plan.priceAnnual / 100 / 12;

  const annualSavingsPercent =
    !isFreePlan && plan.priceAnnual > 0
      ? Math.round((1 - plan.priceAnnual / 100 / 12 / (plan.priceMonthly / 100)) * 100)
      : 0;

  async function handleCta() {
    if (plan.tier === "enterprise") {
      router.push("/contact");
      return;
    }

    setLoading(true);
    try {
      const priceId =
        interval === "month"
          ? plan.stripePriceIdMonthly
          : plan.stripePriceIdAnnual;

      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, interval }),
      });

      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card
      className={`relative flex flex-col ${
        plan.highlighted
          ? "border-primary shadow-lg ring-2 ring-primary ring-offset-2"
          : ""
      }`}
    >
      {plan.highlighted && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-3">
          Most Popular
        </Badge>
      )}

      <CardHeader className="pb-4">
        <CardTitle className="text-xl">{plan.name}</CardTitle>
        <CardDescription>{plan.tagline}</CardDescription>

        <div className="mt-4 flex items-baseline gap-1">
          {isFreePlan ? (
            <span className="text-4xl font-bold">Free</span>
          ) : (
            <>
              <span className="text-4xl font-bold">
                ${displayPrice.toFixed(0)}
              </span>
              <span className="text-muted-foreground">/month</span>
            </>
          )}
        </div>

        {interval === "year" && annualSavingsPercent > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400">
            Save {annualSavingsPercent}% with annual billing
          </p>
        )}

        {!isFreePlan && interval === "year" && (
          <p className="text-xs text-muted-foreground">
            Billed annually (${(plan.priceAnnual / 100).toFixed(0)}/year)
          </p>
        )}
      </CardHeader>

      <CardContent className="flex-1 pb-6">
        <Separator className="mb-6" />
        <FeatureList features={plan.features} highlighted={plan.highlighted} />
      </CardContent>

      <CardFooter>
        <Button
          className="w-full"
          variant={plan.highlighted ? "default" : "outline"}
          disabled={isCurrent || loading}
          onClick={handleCta}
        >
          {loading
            ? "Redirecting…"
            : isCurrent
            ? "Current plan"
            : plan.ctaLabel}
        </Button>
      </CardFooter>
    </Card>
  );
}

"use client";

import { useState, useEffect } from "react";
import type { SubscriptionState, PlanTier } from "@/types/billing";
import { PLAN_CONFIGS } from "@/types/billing";

interface UseSubscriptionResult {
  state: SubscriptionState | null;
  tier: PlanTier;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Client hook for the current user's subscription state.
 * Fetches from /api/billing/subscription (implement this route to return
 * subscription state for the authenticated user's org).
 *
 * In this skeleton, returns stub data so the UI renders.
 */
export function useSubscription(): UseSubscriptionResult {
  const [state, setState] = useState<SubscriptionState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [trigger, setTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function fetchSubscription() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/billing/subscription");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { subscription: SubscriptionState | null };
        if (!cancelled) setState(data.subscription);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchSubscription();
    return () => { cancelled = true; };
  }, [trigger]);

  return {
    state,
    tier: state?.tier ?? "free",
    isLoading,
    error,
    refetch: () => setTrigger((t) => t + 1),
  };
}

/**
 * Returns true if the current subscription tier includes the given required tier.
 */
export function useHasPlanAccess(requiredTier: PlanTier): boolean {
  const { tier } = useSubscription();
  const tierOrder: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };
  return tierOrder[tier] >= tierOrder[requiredTier];
}

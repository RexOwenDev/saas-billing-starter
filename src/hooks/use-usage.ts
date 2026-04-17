"use client";

import { useState, useEffect } from "react";
import type { MeteredEvent } from "@/types/billing";

interface UsageData {
  feature: MeteredEvent;
  total: number;
  periodStart: string;
  periodEnd: string;
}

interface UseUsageResult {
  usage: Record<MeteredEvent, number>;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Client hook for current-period usage metrics.
 * Fetches from /api/billing/usage.
 */
export function useUsage(): UseUsageResult {
  const [usage, setUsage] = useState<Record<MeteredEvent, number>>({
    api_calls: 0,
    storage_gb: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchUsage() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/billing/usage");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { usage: UsageData[] };
        if (!cancelled) {
          const mapped = data.usage.reduce(
            (acc, item) => {
              acc[item.feature] = item.total;
              return acc;
            },
            { api_calls: 0, storage_gb: 0 } as Record<MeteredEvent, number>
          );
          setUsage(mapped);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void fetchUsage();
    return () => { cancelled = true; };
  }, []);

  return { usage, isLoading, error };
}

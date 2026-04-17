import type { PlanTier } from "@/types/billing";
import { PLAN_LIMITS } from "@/types/billing";

type LimitKey = keyof typeof PLAN_LIMITS.free;

/**
 * Returns the plan limit for a given feature.
 * Returns -1 for unlimited features.
 */
export function getLimitForFeature(tier: PlanTier, feature: LimitKey): number {
  return PLAN_LIMITS[tier][feature];
}

/**
 * Returns true if the given usage is at or over the plan limit.
 * Always returns false for unlimited features (limit === -1).
 */
export function isOverLimit(
  tier: PlanTier,
  feature: LimitKey,
  currentUsage: number
): boolean {
  const limit = getLimitForFeature(tier, feature);
  return limit !== -1 && currentUsage >= limit;
}

/**
 * Returns how much of the limit has been consumed as a percentage (0–100).
 * Returns 0 for unlimited features.
 */
export function getUsagePercent(
  tier: PlanTier,
  feature: LimitKey,
  currentUsage: number
): number {
  const limit = getLimitForFeature(tier, feature);
  if (limit === -1) return 0;
  return Math.min((currentUsage / limit) * 100, 100);
}

/**
 * Returns the number of remaining units before the limit is hit.
 * Returns Infinity for unlimited features.
 */
export function getRemainingUsage(
  tier: PlanTier,
  feature: LimitKey,
  currentUsage: number
): number {
  const limit = getLimitForFeature(tier, feature);
  if (limit === -1) return Infinity;
  return Math.max(limit - currentUsage, 0);
}

/**
 * Check multiple features at once. Returns an object with { feature: isOverLimit }.
 */
export function checkAllLimits(
  tier: PlanTier,
  usage: Partial<Record<LimitKey, number>>
): Record<LimitKey, boolean> {
  return (Object.keys(PLAN_LIMITS[tier]) as LimitKey[]).reduce(
    (acc, key) => {
      acc[key] = isOverLimit(tier, key, usage[key] ?? 0);
      return acc;
    },
    {} as Record<LimitKey, boolean>
  );
}

import type { PlanTier, PlanFeatures } from "@/types/billing";
import { PLAN_CONFIGS } from "@/types/billing";

/**
 * Returns the full feature set for a given plan tier.
 */
export function getPlanFeatures(tier: PlanTier): PlanFeatures {
  return PLAN_CONFIGS[tier].features;
}

/**
 * Returns true if the given plan includes a boolean feature.
 *
 * Usage:
 *   hasFeature("pro", "ssoSaml")  // false
 *   hasFeature("enterprise", "ssoSaml")  // true
 */
export function hasFeature(
  tier: PlanTier,
  feature: keyof Pick<
    PlanFeatures,
    | "customDomain"
    | "advancedAnalytics"
    | "prioritySupport"
    | "ssoSaml"
    | "auditLog"
    | "apiAccess"
    | "customBranding"
    | "dedicatedInfrastructure"
  >
): boolean {
  return PLAN_CONFIGS[tier].features[feature];
}

/**
 * Returns the numeric limit for a feature (-1 = unlimited).
 */
export function getFeatureLimit(
  tier: PlanTier,
  feature: "apiCallsPerMonth" | "storageGb" | "teamMembers" | "projects"
): number {
  return PLAN_CONFIGS[tier].features[feature];
}

/**
 * Returns true if planA has all the features of planB.
 * Used to determine if an upgrade is needed before accessing a feature.
 */
export function planIncludes(planA: PlanTier, planB: PlanTier): boolean {
  const tierOrder: Record<PlanTier, number> = { free: 0, pro: 1, enterprise: 2 };
  return tierOrder[planA] >= tierOrder[planB];
}

/**
 * Returns the minimum plan tier required to access a feature.
 */
export function minimumPlanForFeature(
  feature: keyof Pick<
    PlanFeatures,
    | "customDomain"
    | "advancedAnalytics"
    | "prioritySupport"
    | "ssoSaml"
    | "auditLog"
    | "apiAccess"
    | "customBranding"
    | "dedicatedInfrastructure"
  >
): PlanTier {
  const tiers: PlanTier[] = ["free", "pro", "enterprise"];
  for (const tier of tiers) {
    if (PLAN_CONFIGS[tier].features[feature]) return tier;
  }
  return "enterprise";
}

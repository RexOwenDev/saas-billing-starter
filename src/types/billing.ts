// ============================================================
// types/billing.ts
// Plan tiers, feature flags, pricing config, and usage limits.
// Single source of truth for what each plan can and cannot do.
// ============================================================

// ============================================================
// Plan tiers
// ============================================================

export type PlanTier = "free" | "pro" | "enterprise";

export type BillingInterval = "month" | "year";

// ============================================================
// Feature flags per plan
// ============================================================

export interface PlanFeatures {
  // Usage limits
  apiCallsPerMonth: number; // -1 = unlimited
  storageGb: number;
  teamMembers: number; // -1 = unlimited
  projects: number; // -1 = unlimited
  // Feature gates
  customDomain: boolean;
  advancedAnalytics: boolean;
  prioritySupport: boolean;
  ssoSaml: boolean;
  auditLog: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  dedicatedInfrastructure: boolean;
  // SLA
  uptimeSlaPercent: number | null; // e.g. 99.9 — null means no SLA
}

// ============================================================
// Plan configuration
// ============================================================

export interface PlanConfig {
  tier: PlanTier;
  name: string;
  tagline: string;
  stripePriceIdMonthly: string;
  stripePriceIdAnnual: string;
  priceMonthly: number; // USD cents
  priceAnnual: number; // USD cents (total for year)
  features: PlanFeatures;
  highlighted: boolean; // Show "Most Popular" badge
  ctaLabel: string;
}

// ============================================================
// Plan definitions — matches seed.sql and Stripe products
// ============================================================

export const PLAN_CONFIGS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    name: "Free",
    tagline: "For individuals and side projects",
    stripePriceIdMonthly: process.env.STRIPE_FREE_PRICE_ID ?? "price_free_monthly_demo",
    stripePriceIdAnnual: process.env.STRIPE_FREE_PRICE_ID ?? "price_free_monthly_demo",
    priceMonthly: 0,
    priceAnnual: 0,
    highlighted: false,
    ctaLabel: "Start for free",
    features: {
      apiCallsPerMonth: 1_000,
      storageGb: 1,
      teamMembers: 1,
      projects: 3,
      customDomain: false,
      advancedAnalytics: false,
      prioritySupport: false,
      ssoSaml: false,
      auditLog: false,
      apiAccess: false,
      customBranding: false,
      dedicatedInfrastructure: false,
      uptimeSlaPercent: null,
    },
  },
  pro: {
    tier: "pro",
    name: "Pro",
    tagline: "For growing teams that need more power",
    stripePriceIdMonthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "price_pro_monthly_demo",
    stripePriceIdAnnual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "price_pro_annual_demo",
    priceMonthly: 2900, // $29
    priceAnnual: 29000, // $290 ($24.17/mo, 2 months free)
    highlighted: true,
    ctaLabel: "Start free trial",
    features: {
      apiCallsPerMonth: 100_000,
      storageGb: 50,
      teamMembers: 10,
      projects: -1,
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: false,
      ssoSaml: false,
      auditLog: true,
      apiAccess: true,
      customBranding: false,
      dedicatedInfrastructure: false,
      uptimeSlaPercent: 99.9,
    },
  },
  enterprise: {
    tier: "enterprise",
    name: "Enterprise",
    tagline: "For scaling organizations with custom needs",
    stripePriceIdMonthly:
      process.env.STRIPE_ENTERPRISE_MONTHLY_PRICE_ID ?? "price_enterprise_monthly_demo",
    stripePriceIdAnnual:
      process.env.STRIPE_ENTERPRISE_ANNUAL_PRICE_ID ?? "price_enterprise_annual_demo",
    priceMonthly: 9900, // $99
    priceAnnual: 99000, // $990 ($82.50/mo, 2 months free)
    highlighted: false,
    ctaLabel: "Contact sales",
    features: {
      apiCallsPerMonth: -1,
      storageGb: 500,
      teamMembers: -1,
      projects: -1,
      customDomain: true,
      advancedAnalytics: true,
      prioritySupport: true,
      ssoSaml: true,
      auditLog: true,
      apiAccess: true,
      customBranding: true,
      dedicatedInfrastructure: true,
      uptimeSlaPercent: 99.99,
    },
  },
};

// ============================================================
// Usage limits (same data, optimised for runtime checks)
// ============================================================

export const PLAN_LIMITS: Record<PlanTier, Pick<PlanFeatures, "apiCallsPerMonth" | "storageGb" | "teamMembers" | "projects">> =
  {
    free: { apiCallsPerMonth: 1_000, storageGb: 1, teamMembers: 1, projects: 3 },
    pro: { apiCallsPerMonth: 100_000, storageGb: 50, teamMembers: 10, projects: -1 },
    enterprise: { apiCallsPerMonth: -1, storageGb: 500, teamMembers: -1, projects: -1 },
  };

// Metered event types reported to Stripe
export const METERED_EVENTS = ["api_calls", "storage_gb"] as const;
export type MeteredEvent = (typeof METERED_EVENTS)[number];

// ============================================================
// Subscription state helpers (used in UI and server components)
// ============================================================

export interface SubscriptionState {
  tier: PlanTier;
  status: string;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  isTrialing: boolean;
  trialEnd: Date | null;
  features: PlanFeatures;
}

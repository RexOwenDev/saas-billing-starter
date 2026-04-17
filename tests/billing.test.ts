import { describe, it, expect } from "vitest";
import {
  getLimitForFeature,
  isOverLimit,
  getUsagePercent,
  getRemainingUsage,
  checkAllLimits,
} from "@/lib/billing/limits";
import {
  getBillingPeriod,
  daysUntilRenewal,
  isTrialing,
  trialDaysRemaining,
  isWithinPeriod,
  formatPeriod,
} from "@/lib/billing/periods";
import {
  estimateProration,
  dailyRate,
} from "@/lib/billing/proration";
import {
  getPlanFeatures,
  hasFeature,
  getFeatureLimit,
  planIncludes,
  minimumPlanForFeature,
} from "@/lib/billing/features";

// ─── Limits ──────────────────────────────────────────────────────────────────

describe("getLimitForFeature", () => {
  it("returns the correct limit for free tier api calls", () => {
    expect(getLimitForFeature("free", "apiCallsPerMonth")).toBe(1_000);
  });

  it("returns the correct limit for pro tier api calls", () => {
    expect(getLimitForFeature("pro", "apiCallsPerMonth")).toBe(100_000);
  });

  it("returns -1 (unlimited) for enterprise tier api calls", () => {
    expect(getLimitForFeature("enterprise", "apiCallsPerMonth")).toBe(-1);
  });

  it("returns the correct storage limit for free tier", () => {
    expect(getLimitForFeature("free", "storageGb")).toBe(1);
  });

  it("returns the correct team members limit for pro tier", () => {
    expect(getLimitForFeature("pro", "teamMembers")).toBe(10);
  });
});

describe("isOverLimit", () => {
  it("returns false when usage is below limit", () => {
    expect(isOverLimit("free", "apiCallsPerMonth", 500)).toBe(false);
  });

  it("returns true when usage equals the limit", () => {
    expect(isOverLimit("free", "apiCallsPerMonth", 1_000)).toBe(true);
  });

  it("returns true when usage exceeds the limit", () => {
    expect(isOverLimit("free", "apiCallsPerMonth", 1_001)).toBe(true);
  });

  it("returns false when limit is -1 (unlimited)", () => {
    expect(isOverLimit("enterprise", "apiCallsPerMonth", 999_999)).toBe(false);
  });
});

describe("getUsagePercent", () => {
  it("returns correct percentage", () => {
    expect(getUsagePercent("free", "apiCallsPerMonth", 500)).toBe(50);
  });

  it("clamps to 100 when over limit", () => {
    expect(getUsagePercent("free", "apiCallsPerMonth", 2_000)).toBe(100);
  });

  it("returns 0 for unlimited tier", () => {
    expect(getUsagePercent("enterprise", "apiCallsPerMonth", 999_999)).toBe(0);
  });

  it("returns 0 when usage is 0", () => {
    expect(getUsagePercent("free", "apiCallsPerMonth", 0)).toBe(0);
  });
});

describe("getRemainingUsage", () => {
  it("returns remaining usage below limit", () => {
    expect(getRemainingUsage("free", "apiCallsPerMonth", 400)).toBe(600);
  });

  it("returns 0 when at or over limit", () => {
    expect(getRemainingUsage("free", "apiCallsPerMonth", 1_200)).toBe(0);
  });

  it("returns Infinity for unlimited tier", () => {
    expect(getRemainingUsage("enterprise", "apiCallsPerMonth", 999_999)).toBe(Infinity);
  });
});

describe("checkAllLimits", () => {
  it("returns false for all features when all usage is below limits", () => {
    const usage = { apiCallsPerMonth: 100, storageGb: 0.1 };
    const result = checkAllLimits("free", usage);
    expect(result.apiCallsPerMonth).toBe(false);
    expect(result.storageGb).toBe(false);
  });

  it("flags exceeded api calls limit", () => {
    const usage = { apiCallsPerMonth: 1_100 };
    const result = checkAllLimits("free", usage);
    expect(result.apiCallsPerMonth).toBe(true);
    expect(result.storageGb).toBe(false);
  });

  it("returns false for all limits on enterprise (unlimited)", () => {
    const usage = { apiCallsPerMonth: 5_000_000, storageGb: 200, teamMembers: 500 };
    const result = checkAllLimits("enterprise", usage);
    expect(result.apiCallsPerMonth).toBe(false);
    expect(result.teamMembers).toBe(false);
  });
});

// ─── Periods ─────────────────────────────────────────────────────────────────

describe("getBillingPeriod", () => {
  it("converts Stripe Unix timestamps to Date objects", () => {
    const period = getBillingPeriod({
      currentPeriodStart: 1700000000,
      currentPeriodEnd: 1702678400,
    });
    expect(period.start).toBeInstanceOf(Date);
    expect(period.end).toBeInstanceOf(Date);
    expect(period.end.getTime()).toBeGreaterThan(period.start.getTime());
  });
});

describe("daysUntilRenewal", () => {
  it("returns 0 for a date in the past", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(daysUntilRenewal(past)).toBe(0);
  });

  it("returns positive number for a future date", () => {
    const future = new Date(Date.now() + 7 * 86_400_000);
    const days = daysUntilRenewal(future);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(7);
  });
});

describe("isTrialing", () => {
  it("returns true when status is trialing and trial end is in the future", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isTrialing({ status: "trialing", trialEnd: future })).toBe(true);
  });

  it("returns false when status is active (not trialing)", () => {
    const future = new Date(Date.now() + 86_400_000);
    expect(isTrialing({ status: "active", trialEnd: future })).toBe(false);
  });

  it("returns false when trial end is in the past", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(isTrialing({ status: "trialing", trialEnd: past })).toBe(false);
  });

  it("returns false when trialEnd is null", () => {
    expect(isTrialing({ status: "trialing", trialEnd: null })).toBe(false);
  });
});

describe("trialDaysRemaining", () => {
  it("returns 0 when trial has ended", () => {
    const past = new Date(Date.now() - 86_400_000);
    expect(trialDaysRemaining(past)).toBe(0);
  });

  it("returns 0 when trialEnd is null", () => {
    expect(trialDaysRemaining(null)).toBe(0);
  });

  it("returns positive integer for active trial", () => {
    const future = new Date(Date.now() + 3 * 86_400_000);
    const days = trialDaysRemaining(future);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(3);
  });
});

describe("isWithinPeriod", () => {
  it("returns true for a date within the period", () => {
    const period = {
      start: new Date(Date.now() - 86_400_000 * 10),
      end: new Date(Date.now() + 86_400_000 * 20),
    };
    expect(isWithinPeriod(new Date(), period)).toBe(true);
  });

  it("returns false for a date before the period", () => {
    const period = {
      start: new Date(Date.now() + 86_400_000 * 5),
      end: new Date(Date.now() + 86_400_000 * 35),
    };
    expect(isWithinPeriod(new Date(), period)).toBe(false);
  });

  it("returns false for a date after the period", () => {
    const period = {
      start: new Date(Date.now() - 86_400_000 * 35),
      end: new Date(Date.now() - 86_400_000 * 5),
    };
    expect(isWithinPeriod(new Date(), period)).toBe(false);
  });
});

describe("formatPeriod", () => {
  it("returns a non-empty string", () => {
    const period = {
      start: new Date("2026-05-01"),
      end: new Date("2026-05-31"),
    };
    const result = formatPeriod(period);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
    expect(result).toContain("–");
  });
});

// ─── Proration ───────────────────────────────────────────────────────────────

describe("dailyRate", () => {
  it("calculates daily rate for a 30-day period", () => {
    expect(dailyRate(3000, 30)).toBe(100);
  });

  it("uses default 30 days when not specified", () => {
    expect(dailyRate(3000)).toBe(100);
  });

  it("returns Infinity when daysInMonth is 0 (no guard — document this behavior)", () => {
    // dailyRate does not guard against 0 — callers should ensure daysInMonth > 0
    expect(dailyRate(1000, 0)).toBe(Infinity);
  });
});

describe("estimateProration", () => {
  it("returns an estimate with correct shape", () => {
    const result = estimateProration({
      currentPriceMonthly: 1000,
      newPriceMonthly: 3000,
      daysRemainingInPeriod: 15,
      daysInPeriod: 30,
    });
    expect(result).toHaveProperty("unusedCredit");
    expect(result).toHaveProperty("newPlanCharge");
    expect(result).toHaveProperty("immediateCharge");
    expect(result).toHaveProperty("newPlanMonthlyPrice");
    expect(result).toHaveProperty("summary");
  });

  it("returns positive immediateCharge when upgrading", () => {
    const result = estimateProration({
      currentPriceMonthly: 1000,
      newPriceMonthly: 3000,
      daysRemainingInPeriod: 15,
      daysInPeriod: 30,
    });
    // upgrading: new plan is more expensive
    expect(result.immediateCharge).toBeGreaterThan(0);
    expect(result.unusedCredit).toBeLessThan(0);
    expect(result.newPlanCharge).toBeGreaterThan(0);
  });

  it("returns negative immediateCharge when downgrading", () => {
    const result = estimateProration({
      currentPriceMonthly: 3000,
      newPriceMonthly: 1000,
      daysRemainingInPeriod: 15,
      daysInPeriod: 30,
    });
    // downgrading: credit exceeds new plan charge
    expect(result.immediateCharge).toBeLessThan(0);
  });

  it("returns zero amounts when daysInPeriod is 0", () => {
    const result = estimateProration({
      currentPriceMonthly: 1000,
      newPriceMonthly: 3000,
      daysRemainingInPeriod: 0,
      daysInPeriod: 0,
    });
    expect(result.unusedCredit).toBe(0);
    expect(result.newPlanCharge).toBe(0);
    expect(result.immediateCharge).toBe(0);
  });

  it("summary is a non-empty string", () => {
    const result = estimateProration({
      currentPriceMonthly: 1000,
      newPriceMonthly: 3000,
      daysRemainingInPeriod: 15,
      daysInPeriod: 30,
    });
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

// ─── Features ────────────────────────────────────────────────────────────────

describe("getPlanFeatures", () => {
  it("returns feature set for free tier", () => {
    const features = getPlanFeatures("free");
    expect(features.customDomain).toBe(false);
    expect(features.apiAccess).toBe(false);
    expect(features.apiCallsPerMonth).toBe(1_000);
  });

  it("returns feature set for pro tier", () => {
    const features = getPlanFeatures("pro");
    expect(features.customDomain).toBe(true);
    expect(features.advancedAnalytics).toBe(true);
    expect(features.apiCallsPerMonth).toBe(100_000);
  });

  it("returns feature set for enterprise tier", () => {
    const features = getPlanFeatures("enterprise");
    expect(features.ssoSaml).toBe(true);
    expect(features.auditLog).toBe(true);
    expect(features.dedicatedInfrastructure).toBe(true);
    expect(features.apiCallsPerMonth).toBe(-1);
  });
});

describe("hasFeature", () => {
  it("returns false for free tier on customDomain", () => {
    expect(hasFeature("free", "customDomain")).toBe(false);
  });

  it("returns true for pro tier on customDomain", () => {
    expect(hasFeature("pro", "customDomain")).toBe(true);
  });

  it("returns false for pro tier on ssoSaml", () => {
    expect(hasFeature("pro", "ssoSaml")).toBe(false);
  });

  it("returns true for enterprise tier on ssoSaml", () => {
    expect(hasFeature("enterprise", "ssoSaml")).toBe(true);
  });

  it("returns false for free tier on auditLog", () => {
    expect(hasFeature("free", "auditLog")).toBe(false);
  });
});

describe("getFeatureLimit", () => {
  it("returns 10 for pro tier teamMembers", () => {
    expect(getFeatureLimit("pro", "teamMembers")).toBe(10);
  });

  it("returns -1 (unlimited) for enterprise tier teamMembers", () => {
    expect(getFeatureLimit("enterprise", "teamMembers")).toBe(-1);
  });

  it("returns -1 (unlimited) for pro tier projects", () => {
    expect(getFeatureLimit("pro", "projects")).toBe(-1);
  });
});

describe("planIncludes", () => {
  it("pro includes free", () => {
    expect(planIncludes("pro", "free")).toBe(true);
  });

  it("free does not include pro", () => {
    expect(planIncludes("free", "pro")).toBe(false);
  });

  it("enterprise includes enterprise (same tier)", () => {
    expect(planIncludes("enterprise", "enterprise")).toBe(true);
  });

  it("free does not include enterprise", () => {
    expect(planIncludes("free", "enterprise")).toBe(false);
  });

  it("enterprise includes all lower tiers", () => {
    expect(planIncludes("enterprise", "pro")).toBe(true);
    expect(planIncludes("enterprise", "free")).toBe(true);
  });
});

describe("minimumPlanForFeature", () => {
  it("customDomain requires at least pro", () => {
    const minPlan = minimumPlanForFeature("customDomain");
    expect(planIncludes("pro", minPlan)).toBe(true);
    expect(planIncludes("free", minPlan)).toBe(false);
  });

  it("ssoSaml requires enterprise", () => {
    expect(minimumPlanForFeature("ssoSaml")).toBe("enterprise");
  });

  it("returns a valid plan tier string", () => {
    const validTiers = ["free", "pro", "enterprise"];
    expect(validTiers).toContain(minimumPlanForFeature("apiAccess"));
  });
});

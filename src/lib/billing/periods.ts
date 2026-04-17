/**
 * Billing period utilities.
 * All period calculations are deterministic and pure (no DB calls).
 */

export interface BillingPeriod {
  start: Date;
  end: Date;
}

/**
 * Returns the billing period boundaries for a given subscription period.
 * Converts Stripe's Unix timestamps to Date objects.
 */
export function getBillingPeriod(params: {
  currentPeriodStart: number; // Unix seconds from Stripe
  currentPeriodEnd: number;   // Unix seconds from Stripe
}): BillingPeriod {
  return {
    start: new Date(params.currentPeriodStart * 1000),
    end: new Date(params.currentPeriodEnd * 1000),
  };
}

/**
 * Returns the number of days remaining in the current billing period.
 */
export function daysUntilRenewal(periodEnd: Date): number {
  const msRemaining = periodEnd.getTime() - Date.now();
  return Math.max(Math.ceil(msRemaining / (1000 * 60 * 60 * 24)), 0);
}

/**
 * Returns true if the given date is within the billing period.
 */
export function isWithinPeriod(date: Date, period: BillingPeriod): boolean {
  return date >= period.start && date <= period.end;
}

/**
 * Returns true if the subscription is currently in a trial.
 */
export function isTrialing(params: {
  status: string;
  trialEnd: Date | null;
}): boolean {
  if (params.status !== "trialing") return false;
  if (!params.trialEnd) return false;
  return params.trialEnd > new Date();
}

/**
 * Returns the number of days remaining in the trial.
 * Returns 0 if not trialing or trial has ended.
 */
export function trialDaysRemaining(trialEnd: Date | null): number {
  if (!trialEnd) return 0;
  const msRemaining = trialEnd.getTime() - Date.now();
  return Math.max(Math.ceil(msRemaining / (1000 * 60 * 60 * 24)), 0);
}

/**
 * Formats a billing period for display. e.g. "May 1 – May 31, 2026"
 */
export function formatPeriod(period: BillingPeriod): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startStr = period.start.toLocaleDateString("en-US", opts);
  const endStr = period.end.toLocaleDateString("en-US", {
    ...opts,
    year: "numeric",
  });
  return `${startStr} – ${endStr}`;
}

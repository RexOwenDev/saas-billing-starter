/**
 * Proration calculation utilities.
 *
 * Stripe handles proration automatically when you call
 * stripe.subscriptions.update() with proration_behavior: "create_prorations".
 * These utilities help you display the expected cost to users BEFORE they
 * confirm the plan change.
 *
 * Formula reference:
 * https://docs.stripe.com/billing/subscriptions/prorations
 */

export interface ProrationEstimate {
  /** Credit for unused time on current plan (negative amount in cents) */
  unusedCredit: number;
  /** Charge for remaining time on new plan (positive amount in cents) */
  newPlanCharge: number;
  /** Net amount billed immediately (can be negative = credit applied to next invoice) */
  immediateCharge: number;
  /** Full monthly price of the new plan in cents */
  newPlanMonthlyPrice: number;
  /** Human-readable summary */
  summary: string;
}

/**
 * Calculates the proration estimate for a plan change mid-cycle.
 * This is an approximation — Stripe's actual calculation may differ slightly
 * due to timezone handling and invoice rounding.
 *
 * @param currentPriceMonthly - Current plan price in cents (monthly)
 * @param newPriceMonthly - New plan price in cents (monthly)
 * @param daysRemainingInPeriod - Days left in the current billing period
 * @param daysInPeriod - Total days in the billing period (typically ~30)
 */
export function estimateProration(params: {
  currentPriceMonthly: number;
  newPriceMonthly: number;
  daysRemainingInPeriod: number;
  daysInPeriod: number;
}): ProrationEstimate {
  const { currentPriceMonthly, newPriceMonthly, daysRemainingInPeriod, daysInPeriod } = params;

  if (daysInPeriod === 0) {
    return {
      unusedCredit: 0,
      newPlanCharge: 0,
      immediateCharge: 0,
      newPlanMonthlyPrice: newPriceMonthly,
      summary: "No proration — billing period not started.",
    };
  }

  const fractionRemaining = daysRemainingInPeriod / daysInPeriod;

  // Credit for unused time on current plan
  const unusedCredit = -Math.round(currentPriceMonthly * fractionRemaining);

  // Charge for new plan for remaining period
  const newPlanCharge = Math.round(newPriceMonthly * fractionRemaining);

  const immediateCharge = unusedCredit + newPlanCharge;

  const formatAmount = (cents: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(Math.abs(cents) / 100);

  let summary: string;
  if (immediateCharge > 0) {
    summary = `You'll be charged ${formatAmount(immediateCharge)} now for the ${daysRemainingInPeriod} days remaining in your billing period.`;
  } else if (immediateCharge < 0) {
    summary = `You'll receive a ${formatAmount(-immediateCharge)} credit applied to your next invoice.`;
  } else {
    summary = "No immediate charge — prices are equivalent for the remaining period.";
  }

  return {
    unusedCredit,
    newPlanCharge,
    immediateCharge,
    newPlanMonthlyPrice: newPriceMonthly,
    summary,
  };
}

/**
 * Returns the prorated daily rate for a given monthly price.
 */
export function dailyRate(monthlyPriceCents: number, daysInMonth = 30): number {
  return monthlyPriceCents / daysInMonth;
}

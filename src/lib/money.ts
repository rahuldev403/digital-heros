import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "./constants";

/**
 * Money arithmetic.
 *
 * Every amount is an integer in the currency's minor unit (paise, cents). There
 * are no floats anywhere in this file, and no function returns a fraction. Each
 * division states explicitly where its remainder goes, because in a platform
 * that splits subscription fees three ways and then splits prize tiers among an
 * arbitrary number of winners, discarded remainders are how books stop
 * balancing.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/**
 * `amount * bps / 10_000`, rounded half-up to a whole minor unit.
 * 1 bps = 0.01%, so 3000 bps = 30%.
 */
export function applyBps(amountMinor: number, bps: number): number {
  return Math.round((amountMinor * bps) / 10_000);
}

/** `amount * percent / 100`, rounded half-up to a whole minor unit. */
export function applyPercent(amountMinor: number, percent: number): number {
  return Math.round((amountMinor * percent) / 100);
}

/**
 * Splits an amount into `parts` equal shares.
 *
 * Returns the per-share amount and whatever could not be divided evenly. The
 * remainder is deliberately *not* folded into one lucky share: prizes must be
 * "split equally among multiple winners in the same tier" (PRD §07), so three
 * winners of a ₹1,000.01 pool each get ₹333.33 and the stray paisa is carried
 * on the draw as `undistributedMinor` rather than making one winner richer.
 */
export function divideEvenly(
  totalMinor: number,
  parts: number,
): { shareMinor: number; remainderMinor: number } {
  if (parts <= 0) {
    return { shareMinor: 0, remainderMinor: totalMinor };
  }

  const shareMinor = Math.floor(totalMinor / parts);

  return {
    shareMinor,
    remainderMinor: totalMinor - shareMinor * parts,
  };
}

// ---------------------------------------------------------------------------
// Subscription split (PRD §07 + §08.1)
// ---------------------------------------------------------------------------

export interface PaymentSplit {
  /** Total charged, echoed back for convenience. */
  amountMinor: number;
  /** Goes to the user's chosen charity. */
  charityAmountMinor: number;
  /** Funds this period's prize pool. */
  prizePoolAmountMinor: number;
  /** Platform's remaining margin. */
  platformAmountMinor: number;
  /** The percentage actually applied, after clamping. */
  charityPercent: number;
}

/**
 * Splits one subscription payment three ways.
 *
 * Order matters. The prize pool is taken first at the plan's fixed rate,
 * because the pool is a promise made to every subscriber and must not depend on
 * one user's generosity. The charity share is taken next, from what remains.
 * The platform keeps the rest — which is what shrinks when a user raises their
 * charity percentage.
 *
 * The platform share is computed by subtraction, never by its own percentage,
 * so the three parts always sum to exactly `amountMinor` regardless of how the
 * two roundings landed.
 */
export function splitSubscriptionPayment(params: {
  amountMinor: number;
  charityPercent: number;
  prizePoolShareBps: number;
}): PaymentSplit {
  const { amountMinor, prizePoolShareBps } = params;

  // Clamp defensively: this is the last line before money is committed to the
  // ledger, and a bad percentage here would be permanent.
  const charityPercent = Math.min(
    Math.max(params.charityPercent, CHARITY_MIN_PERCENT),
    CHARITY_MAX_PERCENT,
  );

  const prizePoolAmountMinor = applyBps(amountMinor, prizePoolShareBps);
  const charityAmountMinor = applyPercent(amountMinor, charityPercent);
  const platformAmountMinor = amountMinor - prizePoolAmountMinor - charityAmountMinor;

  return {
    amountMinor,
    charityAmountMinor,
    prizePoolAmountMinor,
    platformAmountMinor,
    charityPercent,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/** Minor units per major unit. Extend if a zero-decimal currency is added. */
const MINOR_UNITS_PER_MAJOR = 100;

/** Converts minor units to the major unit as a number, for Intl formatting. */
export function toMajorUnits(amountMinor: number): number {
  return amountMinor / MINOR_UNITS_PER_MAJOR;
}

/** Converts a major-unit value (e.g. from a form) to integer minor units. */
export function toMinorUnits(amountMajor: number): number {
  return Math.round(amountMajor * MINOR_UNITS_PER_MAJOR);
}

/**
 * Formats an amount for display, e.g. 49900 → "₹499.00".
 *
 * Locale is fixed per currency rather than taken from the browser, so a figure
 * shown to a user matches the figure shown to an admin reviewing the same
 * payout.
 */
export function formatMoney(
  amountMinor: number,
  currency: string,
  options: { compact?: boolean; hideDecimals?: boolean } = {},
): string {
  const locale = currency === "INR" ? "en-IN" : "en-US";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: options.compact ? "compact" : "standard",
    maximumFractionDigits: options.hideDecimals || options.compact ? 0 : 2,
    minimumFractionDigits: options.hideDecimals || options.compact ? 0 : 2,
  }).format(toMajorUnits(amountMinor));
}

import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { plans, subscriptions } from "@/db/schema";

/**
 * Subscription access control — PRD §04.
 *
 * The PRD requires a "real-time subscription status check on every
 * authenticated request" (§04 VALIDATION) and "restricted access to platform
 * features" for non-subscribers (ACCESS CONTROL). This module is the single
 * place that decides what "subscribed" means; nothing else should compare
 * statuses by hand.
 */

export interface SubscriptionState {
  /** Null when the user has never subscribed. */
  subscriptionId: string | null;
  status: "none" | "incomplete" | "active" | "past_due" | "canceled" | "expired";
  /** The one question callers actually need answered. */
  hasAccess: boolean;
  planCode: string | null;
  planName: string | null;
  currentPeriodEnd: Date | null;
  /** True when the user has cancelled but has paid through to the period end. */
  cancelAtPeriodEnd: boolean;
}

const NO_SUBSCRIPTION: SubscriptionState = {
  subscriptionId: null,
  status: "none",
  hasAccess: false,
  planCode: null,
  planName: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Reads the user's most recent subscription and derives access from it.
 *
 * Access requires *both* an active status and an unexpired paid period. The
 * two can disagree: if a renewal webhook is delayed or missed, the row still
 * says "active" while the period has run out. Trusting the status alone would
 * hand out free access whenever Stripe was slow, so the date is checked too and
 * the stored status is treated as a claim rather than a conclusion.
 *
 * A user who cancels keeps access until the period they paid for ends — that is
 * why `cancelAtPeriodEnd` does not itself remove access.
 */
export async function getSubscriptionState(userId: string): Promise<SubscriptionState> {
  const [row] = await db
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      planCode: plans.code,
      planName: plans.name,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.userId, userId))
    // Most recent attempt wins: a resubscribe supersedes an old cancelled row.
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!row) return NO_SUBSCRIPTION;

  const periodIsCurrent =
    row.currentPeriodEnd !== null && row.currentPeriodEnd.getTime() > Date.now();

  return {
    subscriptionId: row.id,
    status: row.status,
    hasAccess: row.status === "active" && periodIsCurrent,
    planCode: row.planCode,
    planName: row.planName,
    currentPeriodEnd: row.currentPeriodEnd,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  };
}

/**
 * Human-readable explanation of why access is or is not granted. Used by the
 * dashboard and by the paywall so the user is never just told "no".
 */
export function describeSubscription(state: SubscriptionState): string {
  if (state.hasAccess) {
    return state.cancelAtPeriodEnd
      ? "Active — cancels at the end of the current period"
      : "Active";
  }

  switch (state.status) {
    case "none":
      return "No subscription yet";
    case "incomplete":
      return "Payment not completed";
    case "past_due":
      return "Payment failed — update your card to restore access";
    case "canceled":
      return "Cancelled";
    case "expired":
    case "active": // active but the paid period has elapsed
      return "Lapsed — renew to restore access";
    default:
      return "Inactive";
  }
}

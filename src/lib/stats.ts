import "server-only";

import { and, count, eq, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { charities, payments, subscriptions } from "@/db/schema";

import { currentPeriodKey } from "./period";

/**
 * Public platform statistics.
 *
 * Read live from the payments ledger rather than kept in a counter column.
 * Ledger rows are immutable, so a SUM over them is always correct, whereas a
 * running total drifts the first time a webhook is retried or a refund is
 * processed. At this scale the aggregate is trivial; when it stops being
 * trivial the answer is a materialised view over the same rows, not a counter.
 */

export interface PlatformStats {
  charityRaisedMinor: number;
  prizePoolMinor: number;
  activeSubscribers: number;
  charityCount: number;
  currency: string;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const period = currentPeriodKey();

  const [[charityRow], [poolRow], [subscriberRow], [charityCountRow]] =
    await Promise.all([
      // All-time charity contributions from succeeded payments.
      db
        .select({
          total: sum(payments.charityAmountMinor).mapWith(Number),
          currency: sql<string>`min(${payments.currency})`,
        })
        .from(payments)
        .where(eq(payments.status, "succeeded")),

      // This month's prize pool only — the figure a visitor is deciding about.
      db
        .select({ total: sum(payments.prizePoolAmountMinor).mapWith(Number) })
        .from(payments)
        .where(
          and(eq(payments.status, "succeeded"), eq(payments.periodKey, period)),
        ),

      db
        .select({ total: count() })
        .from(subscriptions)
        .where(eq(subscriptions.status, "active")),

      db
        .select({ total: count() })
        .from(charities)
        .where(eq(charities.isActive, true)),
    ]);

  return {
    // SUM over no rows is NULL in SQL, which arrives as null, not 0.
    charityRaisedMinor: charityRow?.total ?? 0,
    prizePoolMinor: poolRow?.total ?? 0,
    activeSubscribers: subscriberRow?.total ?? 0,
    charityCount: charityCountRow?.total ?? 0,
    currency: charityRow?.currency ?? process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
  };
}

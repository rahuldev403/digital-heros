import "server-only";

import { and, eq, sql, type AnyColumn, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { charities, donations, payments } from "@/db/schema";

/**
 * Charitable giving — the single definition of "raised".
 *
 * Money reaches a charity two ways: the charity share of each subscription
 * payment (PRD §08.1) and one-off donations (§08.1, "independent donation
 * option"). They live in separate tables on purpose (decision D16), which means
 * every page that shows a total has to add both — and before this module
 * existed, only one page did. The charity profile showed a donor's gift; the
 * homepage, directory, spotlight, admin reports and the donor's own dashboard
 * did not.
 *
 * Every "raised" or "given" figure in the app now comes from here, so they
 * cannot disagree again.
 */

/**
 * SQL for one charity's total, for use as a column inside a larger select.
 * Both halves count succeeded money only — a pending or failed payment was
 * never received.
 */
export function charityRaisedSql(charityId: AnyColumn | SQL): SQL<number> {
  return sql<number>`(
    (select coalesce(sum(p.charity_amount_minor), 0)
       from ${payments} p
      where p.charity_id = ${charityId} and p.status = 'succeeded')
    +
    (select coalesce(sum(d.amount_minor), 0)
       from ${donations} d
      where d.charity_id = ${charityId} and d.status = 'succeeded')
  )::int`;
}

export interface GivingTotals {
  /** Charity shares of subscription payments. */
  subscriptionMinor: number;
  /** One-off donations. */
  donationMinor: number;
  totalMinor: number;
}

function toTotals(subscriptionMinor: number, donationMinor: number): GivingTotals {
  return {
    subscriptionMinor,
    donationMinor,
    totalMinor: subscriptionMinor + donationMinor,
  };
}

/** Everything raised for every charity, all time. */
export async function getPlatformGiving(): Promise<GivingTotals> {
  const [[sub], [don]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int` })
      .from(payments)
      .where(eq(payments.status, "succeeded")),
    db
      .select({ total: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::int` })
      .from(donations)
      .where(eq(donations.status, "succeeded")),
  ]);

  return toTotals(sub?.total ?? 0, don?.total ?? 0);
}

/** Everything raised for one charity. */
export async function getCharityGiving(charityId: string): Promise<GivingTotals> {
  const [[sub], [don]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.charityId, charityId), eq(payments.status, "succeeded"))),
    db
      .select({ total: sql<number>`coalesce(sum(${donations.amountMinor}), 0)::int` })
      .from(donations)
      .where(and(eq(donations.charityId, charityId), eq(donations.status, "succeeded"))),
  ]);

  return toTotals(sub?.total ?? 0, don?.total ?? 0);
}

/**
 * Everything one member has given — their subscription charity shares plus any
 * one-off gifts made while signed in — with a per-charity breakdown.
 */
export async function getUserGiving(userId: string): Promise<
  GivingTotals & { byCharity: { charityName: string; totalMinor: number }[] }
> {
  const [bySub, byDonation] = await Promise.all([
    db
      .select({
        charityName: charities.name,
        total: sql<number>`sum(${payments.charityAmountMinor})::int`,
      })
      .from(payments)
      .innerJoin(charities, eq(payments.charityId, charities.id))
      .where(and(eq(payments.userId, userId), eq(payments.status, "succeeded")))
      .groupBy(charities.name),
    db
      .select({
        charityName: charities.name,
        total: sql<number>`sum(${donations.amountMinor})::int`,
      })
      .from(donations)
      .innerJoin(charities, eq(donations.charityId, charities.id))
      .where(and(eq(donations.userId, userId), eq(donations.status, "succeeded")))
      .groupBy(charities.name),
  ]);

  const merged = new Map<string, number>();
  for (const row of [...bySub, ...byDonation]) {
    merged.set(row.charityName, (merged.get(row.charityName) ?? 0) + row.total);
  }

  const subscriptionMinor = bySub.reduce((s, r) => s + r.total, 0);
  const donationMinor = byDonation.reduce((s, r) => s + r.total, 0);

  return {
    ...toTotals(subscriptionMinor, donationMinor),
    byCharity: [...merged.entries()]
      .map(([charityName, totalMinor]) => ({ charityName, totalMinor }))
      .sort((a, b) => b.totalMinor - a.totalMinor),
  };
}

import "server-only";

import { and, asc, count, desc, eq, gte, sql, sum } from "drizzle-orm";

import { db } from "@/db";
import { charities, charityEvents, payments, users } from "@/db/schema";

import { currentPeriodKey } from "./period";
import { calculatePool } from "./services/draws";

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
  /** This period's pool, including any jackpot rolled in from a past draw. */
  prizePoolMinor: number;
  /** The portion funded by this period's subscriptions alone. */
  prizePoolBaseMinor: number;
  /** Unclaimed jackpot carried in from the last published draw. */
  rolloverInMinor: number;
  activeSubscribers: number;
  charityCount: number;
  currency: string;
}

export async function getPlatformStats(): Promise<PlatformStats> {
  const period = currentPeriodKey();

  const [[charityRow], pool, [charityCountRow]] = await Promise.all([
    // All-time charity contributions from succeeded payments.
    db
      .select({
        total: sum(payments.charityAmountMinor).mapWith(Number),
        currency: sql<string>`min(${payments.currency})`,
      })
      .from(payments)
      .where(eq(payments.status, "succeeded")),

    // Reuse the draw engine's own pool calculation rather than re-deriving it
    // here. The homepage and the results page were previously computing this
    // two different ways and disagreeing by the rollover amount — one source of
    // truth means a figure quoted on the marketing page is the figure the draw
    // will actually pay out.
    calculatePool(period),

    db
      .select({ total: count() })
      .from(charities)
      .where(eq(charities.isActive, true)),
  ]);

  return {
    // SUM over no rows is NULL in SQL, which arrives as null, not 0.
    charityRaisedMinor: charityRow?.total ?? 0,
    prizePoolMinor: pool.totalMinor,
    prizePoolBaseMinor: pool.baseMinor,
    rolloverInMinor: pool.rolloverInMinor,
    activeSubscribers: pool.activeSubscribers,
    charityCount: charityCountRow?.total ?? 0,
    currency: charityRow?.currency ?? process.env.NEXT_PUBLIC_CURRENCY ?? "EUR",
  };
}

export interface SpotlightCharity {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  summary: string;
  category: string;
  location: string | null;
  coverImageUrl: string | null;
  raisedMinor: number;
  supporters: number;
  nextEvent: { title: string; startsAt: Date; location: string | null } | null;
}

/**
 * The homepage spotlight — PRD §08.2 "Featured charity section on the homepage".
 *
 * The admin chooses it (a single slot; see `setSpotlightAction`). If nobody has
 * been featured — or the featured charity was deactivated — it falls back to
 * the active charity that has raised the most, so the homepage never shows an
 * empty spotlight or promotes a cause that can no longer accept supporters.
 */
export async function getSpotlightCharity(): Promise<SpotlightCharity | null> {
  const raised = sql<number>`(
    select coalesce(sum(p.charity_amount_minor), 0)::int
    from ${payments} p
    where p.charity_id = ${charities.id} and p.status = 'succeeded'
  )`;

  const [row] = await db
    .select({
      id: charities.id,
      slug: charities.slug,
      name: charities.name,
      tagline: charities.tagline,
      summary: charities.summary,
      category: charities.category,
      location: charities.location,
      coverImageUrl: charities.coverImageUrl,
      raisedMinor: raised,
      supporters: sql<number>`(
        select count(*)::int from ${users} u where u.charity_id = ${charities.id}
      )`,
    })
    .from(charities)
    .where(eq(charities.isActive, true))
    // Featured first; otherwise whoever has raised the most.
    .orderBy(desc(charities.isFeatured), desc(raised))
    .limit(1);

  if (!row) return null;

  const [event] = await db
    .select({
      title: charityEvents.title,
      startsAt: charityEvents.startsAt,
      location: charityEvents.location,
    })
    .from(charityEvents)
    .where(and(eq(charityEvents.charityId, row.id), gte(charityEvents.startsAt, new Date())))
    .orderBy(asc(charityEvents.startsAt))
    .limit(1);

  return { ...row, nextEvent: event ?? null };
}

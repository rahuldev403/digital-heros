import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  drawEntries,
  drawWinners,
  draws,
  payments,
  scores,
  subscriptions,
  users,
  type Draw,
} from "@/db/schema";

import {
  DRAW_NUMBER_MAX,
  DRAW_NUMBER_MIN,
  MIN_SCORES_FOR_ENTRY,
  NUMBERS_PER_ENTRY,
  SCORES_RETAINED,
  TIER_SHARE_BPS,
  type PrizeTier,
} from "../constants";
import {
  calculatePrizes,
  countMatches,
  drawWinningNumbers,
  generateSeed,
  type DrawMode,
} from "../draw-engine";
import { formatPeriod, periodDrawDate, shiftPeriodKey } from "../period";

/**
 * Draw lifecycle — PRD §06.
 *
 *   draft     → created; entries can be locked and re-locked
 *   simulated → numbers drawn, winners computed, invisible to players
 *   published → final and visible; prizes become claimable
 *
 * The separation exists because §06 requires "simulation before publish". An
 * admin can simulate repeatedly — each run draws a fresh seed — and nothing is
 * visible to players until publish. Once published a draw is immutable.
 */

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EUR";

// ---------------------------------------------------------------------------
// Pool funding
// ---------------------------------------------------------------------------

/**
 * The money available for a period.
 *
 * `base` is summed from the payments ledger — the prize-pool slice that was
 * snapshotted on each payment when it was taken (see decision D2), never
 * recomputed from today's settings. `rolloverIn` is the unclaimed jackpot from
 * the most recent published draw before this one.
 */
export async function calculatePool(periodKey: string): Promise<{
  baseMinor: number;
  rolloverInMinor: number;
  totalMinor: number;
  activeSubscribers: number;
}> {
  const [[poolRow], [subscriberRow], [previous]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${payments.prizePoolAmountMinor}), 0)::int` })
      .from(payments)
      .where(and(eq(payments.periodKey, periodKey), eq(payments.status, "succeeded"))),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active")),

    db
      .select({ rolloverOutMinor: draws.rolloverOutMinor })
      .from(draws)
      .where(and(eq(draws.status, "published"), sql`${draws.periodKey} < ${periodKey}`))
      .orderBy(desc(draws.periodKey))
      .limit(1),
  ]);

  const baseMinor = poolRow?.total ?? 0;
  const rolloverInMinor = previous?.rolloverOutMinor ?? 0;

  return {
    baseMinor,
    rolloverInMinor,
    totalMinor: baseMinor + rolloverInMinor,
    activeSubscribers: subscriberRow?.total ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Creating
// ---------------------------------------------------------------------------

export async function getDrawByPeriod(periodKey: string): Promise<Draw | undefined> {
  const [row] = await db.select().from(draws).where(eq(draws.periodKey, periodKey)).limit(1);
  return row;
}

/** Creates a draft draw for a period, or returns the existing one. */
export async function createDraw(periodKey: string, mode: DrawMode = "random") {
  const existing = await getDrawByPeriod(periodKey);
  if (existing) return existing;

  const pool = await calculatePool(periodKey);

  const [created] = await db
    .insert(draws)
    .values({
      periodKey,
      name: `${formatPeriod(periodKey)} Draw`,
      mode,
      status: "draft",
      numbersPerEntry: NUMBERS_PER_ENTRY,
      numberMin: DRAW_NUMBER_MIN,
      numberMax: DRAW_NUMBER_MAX,
      currency: CURRENCY,
      basePoolMinor: pool.baseMinor,
      rolloverInMinor: pool.rolloverInMinor,
      totalPoolMinor: pool.totalMinor,
      activeSubscriberCount: pool.activeSubscribers,
      tierSharesBps: TIER_SHARE_BPS,
      drawDate: periodDrawDate(periodKey),
    })
    .returning();

  return created;
}

// ---------------------------------------------------------------------------
// Locking entries
// ---------------------------------------------------------------------------

/**
 * Snapshots every eligible player's scores as their entry.
 *
 * Eligibility is an active subscription plus a full set of five scores. The
 * numbers are *copied* onto the entry rather than joined live, so a player
 * cannot change their entry after the draw, and equally cannot lose a win by
 * logging a new round the next day.
 *
 * Re-runnable while the draw is a draft: it clears and rebuilds, so an admin
 * can lock, see the entry count, and re-lock after more players qualify.
 */
export async function lockEntries(drawId: string): Promise<{
  ok: boolean;
  error?: string;
  entryCount?: number;
}> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1);

  if (!draw) return { ok: false, error: "Draw not found." };
  if (draw.status === "published") {
    return { ok: false, error: "A published draw cannot be changed." };
  }

  // Everyone with an active subscription and a full score set.
  const eligible = await db
    .select({
      userId: users.id,
      scoreCount: sql<number>`count(${scores.id})::int`,
    })
    .from(users)
    .innerJoin(
      subscriptions,
      and(eq(subscriptions.userId, users.id), eq(subscriptions.status, "active")),
    )
    .innerJoin(scores, eq(scores.userId, users.id))
    .where(eq(users.status, "active"))
    .groupBy(users.id)
    .having(sql`count(${scores.id}) >= ${MIN_SCORES_FOR_ENTRY}`);

  if (eligible.length === 0) {
    return { ok: false, error: "No eligible players — nobody has five scores and an active subscription." };
  }

  const userIds = eligible.map((row) => row.userId);

  // One query for every eligible player's scores, then grouped in memory —
  // rather than a query per player, which would be N round trips.
  const allScores = await db
    .select()
    .from(scores)
    .where(inArray(scores.userId, userIds))
    .orderBy(desc(scores.playedOn));

  const byUser = new Map<string, typeof allScores>();
  for (const score of allScores) {
    const list = byUser.get(score.userId) ?? [];
    if (list.length < SCORES_RETAINED) list.push(score);
    byUser.set(score.userId, list);
  }

  const entryRows = userIds
    .map((userId) => {
      const userScores = byUser.get(userId) ?? [];
      if (userScores.length < MIN_SCORES_FOR_ENTRY) return null;

      return {
        drawId,
        userId,
        numbers: userScores.map((s) => s.points),
        scoreSnapshot: userScores.map((s) => ({
          playedOn: s.playedOn,
          points: s.points,
          courseName: s.courseName,
        })),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const pool = await calculatePool(draw.periodKey);

  await db.transaction(async (tx) => {
    // Rebuild from scratch so re-locking is idempotent.
    await tx.delete(drawWinners).where(eq(drawWinners.drawId, drawId));
    await tx.delete(drawEntries).where(eq(drawEntries.drawId, drawId));
    await tx.insert(drawEntries).values(entryRows);

    await tx
      .update(draws)
      .set({
        status: "draft",
        entryCount: entryRows.length,
        basePoolMinor: pool.baseMinor,
        rolloverInMinor: pool.rolloverInMinor,
        totalPoolMinor: pool.totalMinor,
        activeSubscriberCount: pool.activeSubscribers,
        winningNumbers: null,
        randomSeed: null,
        simulatedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(draws.id, drawId));
  });

  return { ok: true, entryCount: entryRows.length };
}

// ---------------------------------------------------------------------------
// Simulating
// ---------------------------------------------------------------------------

/**
 * Draws the numbers and works out who won — PRD §06 "Simulation before publish".
 *
 * Can be run as often as the admin likes while unpublished; each run generates
 * a new seed and replaces the previous result. Nothing here is visible to
 * players until `publishDraw`.
 */
export async function simulateDraw(
  drawId: string,
  mode?: DrawMode,
): Promise<{ ok: boolean; error?: string; draw?: Draw }> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1);

  if (!draw) return { ok: false, error: "Draw not found." };
  if (draw.status === "published") {
    return { ok: false, error: "This draw is already published and cannot be re-run." };
  }

  const entries = await db.select().from(drawEntries).where(eq(drawEntries.drawId, drawId));

  if (entries.length === 0) {
    return { ok: false, error: "Lock the entries before simulating." };
  }

  const effectiveMode = mode ?? draw.mode;
  const seed = generateSeed();

  const winningNumbers = drawWinningNumbers({
    mode: effectiveMode,
    seed,
    entries: entries.map((e) => e.numbers),
    count: draw.numbersPerEntry,
    min: draw.numberMin,
    max: draw.numberMax,
  });

  // Work out each entry's matches, then group the winning ones by tier.
  const results = entries.map((entry) => ({
    entry,
    matched: countMatches(entry.numbers, winningNumbers),
  }));

  const winnerCountByTier: Record<PrizeTier, number> = { 3: 0, 4: 0, 5: 0 };
  for (const { matched } of results) {
    if (matched.length >= 3) {
      winnerCountByTier[matched.length as PrizeTier] += 1;
    }
  }

  const tierShares = (draw.tierSharesBps ?? TIER_SHARE_BPS) as Record<PrizeTier, number>;
  const breakdown = calculatePrizes(draw.totalPoolMinor, winnerCountByTier, tierShares);
  const outcomeByTier = new Map(breakdown.tiers.map((t) => [t.tier, t]));

  const winnerRows = results
    .filter((r) => r.matched.length >= 3)
    .map((r) => {
      const tier = r.matched.length as PrizeTier;
      const outcome = outcomeByTier.get(tier)!;

      return {
        drawId,
        entryId: r.entry.id,
        userId: r.entry.userId,
        tier,
        matchedNumbers: r.matched,
        tierPoolMinor: outcome.tierPoolMinor,
        winnersInTier: outcome.winnerCount,
        prizeMinor: outcome.prizePerWinnerMinor,
        currency: draw.currency,
      };
    });

  const [updated] = await db.transaction(async (tx) => {
    await tx.delete(drawWinners).where(eq(drawWinners.drawId, drawId));

    // Record each entry's match count so a player can see their result even
    // when they did not win.
    for (const { entry, matched } of results) {
      await tx
        .update(drawEntries)
        .set({ matchCount: matched.length })
        .where(eq(drawEntries.id, entry.id));
    }

    if (winnerRows.length > 0) {
      await tx.insert(drawWinners).values(winnerRows);
    }

    return tx
      .update(draws)
      .set({
        status: "simulated",
        mode: effectiveMode,
        winningNumbers,
        randomSeed: seed,
        rolloverOutMinor: breakdown.rolloverOutMinor,
        undistributedMinor: breakdown.undistributedMinor,
        simulatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(draws.id, drawId))
      .returning();
  });

  return { ok: true, draw: updated };
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/** Makes results final and visible. One-way. */
export async function publishDraw(
  drawId: string,
  adminId: string,
): Promise<{ ok: boolean; error?: string }> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1);

  if (!draw) return { ok: false, error: "Draw not found." };
  if (draw.status === "published") return { ok: false, error: "Already published." };
  if (draw.status !== "simulated" || !draw.winningNumbers) {
    return { ok: false, error: "Simulate the draw before publishing it." };
  }

  await db
    .update(draws)
    .set({
      status: "published",
      publishedAt: new Date(),
      publishedBy: adminId,
      updatedAt: new Date(),
    })
    .where(eq(draws.id, drawId));

  return { ok: true };
}

/** Returns a simulated draw to draft so it can be re-locked and re-run. */
export async function resetDraw(drawId: string): Promise<{ ok: boolean; error?: string }> {
  const [draw] = await db.select().from(draws).where(eq(draws.id, drawId)).limit(1);

  if (!draw) return { ok: false, error: "Draw not found." };
  if (draw.status === "published") {
    return { ok: false, error: "A published draw cannot be reset." };
  }

  await db.transaction(async (tx) => {
    await tx.delete(drawWinners).where(eq(drawWinners.drawId, drawId));
    await tx
      .update(drawEntries)
      .set({ matchCount: null })
      .where(eq(drawEntries.drawId, drawId));
    await tx
      .update(draws)
      .set({
        status: "draft",
        winningNumbers: null,
        randomSeed: null,
        simulatedAt: null,
        rolloverOutMinor: 0,
        undistributedMinor: 0,
        updatedAt: new Date(),
      })
      .where(eq(draws.id, drawId));
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

/** Published draws, newest first — the public results list. */
export async function listPublishedDraws(limit = 12) {
  return db
    .select()
    .from(draws)
    .where(eq(draws.status, "published"))
    .orderBy(desc(draws.periodKey))
    .limit(limit);
}

/** Every draw, for the admin panel. */
export async function listAllDraws(limit = 24) {
  return db.select().from(draws).orderBy(desc(draws.periodKey)).limit(limit);
}

/** Winners of a draw, with player names, highest tier first. */
export async function listDrawWinners(drawId: string) {
  return db
    .select({
      id: drawWinners.id,
      userId: drawWinners.userId,
      fullName: users.fullName,
      email: users.email,
      tier: drawWinners.tier,
      matchedNumbers: drawWinners.matchedNumbers,
      prizeMinor: drawWinners.prizeMinor,
      currency: drawWinners.currency,
      verificationStatus: drawWinners.verificationStatus,
      payoutStatus: drawWinners.payoutStatus,
      numbers: drawEntries.numbers,
    })
    .from(drawWinners)
    .innerJoin(users, eq(drawWinners.userId, users.id))
    .innerJoin(drawEntries, eq(drawWinners.entryId, drawEntries.id))
    .where(eq(drawWinners.drawId, drawId))
    .orderBy(desc(drawWinners.tier), desc(drawWinners.prizeMinor));
}

/** A player's own entry and result for a draw. */
export async function getUserEntry(drawId: string, userId: string) {
  const [entry] = await db
    .select()
    .from(drawEntries)
    .where(and(eq(drawEntries.drawId, drawId), eq(drawEntries.userId, userId)))
    .limit(1);

  return entry;
}

/** Every draw this player has entered, with their result. */
export async function listUserEntries(userId: string, limit = 12) {
  return db
    .select({
      drawId: draws.id,
      periodKey: draws.periodKey,
      name: draws.name,
      status: draws.status,
      drawDate: draws.drawDate,
      winningNumbers: draws.winningNumbers,
      currency: draws.currency,
      numbers: drawEntries.numbers,
      matchCount: drawEntries.matchCount,
      prizeMinor: drawWinners.prizeMinor,
      tier: drawWinners.tier,
      verificationStatus: drawWinners.verificationStatus,
      payoutStatus: drawWinners.payoutStatus,
      winnerId: drawWinners.id,
    })
    .from(drawEntries)
    .innerJoin(draws, eq(drawEntries.drawId, draws.id))
    .leftJoin(drawWinners, eq(drawWinners.entryId, drawEntries.id))
    .where(eq(drawEntries.userId, userId))
    .orderBy(desc(draws.periodKey))
    .limit(limit);
}

/** Next period that has no draw yet — what the admin would create next. */
export async function nextDrawPeriod(): Promise<string> {
  const [latest] = await db
    .select({ periodKey: draws.periodKey })
    .from(draws)
    .orderBy(desc(draws.periodKey))
    .limit(1);

  const { currentPeriodKey } = await import("../period");

  if (!latest) return currentPeriodKey();

  return latest.periodKey >= currentPeriodKey()
    ? shiftPeriodKey(latest.periodKey, 1)
    : currentPeriodKey();
}

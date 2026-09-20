import "server-only";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { scores, type Score } from "@/db/schema";

import { SCORE_MAX, SCORE_MIN, SCORES_RETAINED } from "../constants";

/**
 * Score management — PRD §05.
 *
 * All four rules from the brief live here and nowhere else:
 *
 *   1. Range 1–45 (also a CHECK constraint)
 *   2. One entry per date (also a UNIQUE index)
 *   3. Only the latest 5 are retained
 *   4. A new score replaces the oldest
 *
 * Rules 3 and 4 cannot be expressed as constraints, so they are enforced by
 * this module — inside a transaction, so a concurrent insert cannot leave a
 * user holding six scores. Everything that writes a score goes through
 * `addScore`; nothing else may insert into the table.
 */

export type ScoreResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; field?: string };

export interface ScoreInput {
  playedOn: string; // "YYYY-MM-DD"
  points: number;
  courseName?: string | null;
}

/**
 * The user's retained scores, newest first.
 *
 * "Scores display in reverse chronological order (most recent first)" — §05.
 * Ordered by date played, not by when it was entered: a round logged late still
 * belongs at its own date.
 */
export async function listScores(userId: string): Promise<Score[]> {
  return db
    .select()
    .from(scores)
    .where(eq(scores.userId, userId))
    .orderBy(desc(scores.playedOn))
    .limit(SCORES_RETAINED);
}

/** How many more rounds before the player is eligible for a draw. */
export async function countScores(userId: string): Promise<number> {
  const [row] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(scores)
    .where(eq(scores.userId, userId));

  return row?.total ?? 0;
}

/**
 * Records a round, evicting the oldest if the player is already at capacity.
 *
 * The read, the eviction and the insert run in one transaction. Without that,
 * two rounds submitted at once could both see four existing scores, both skip
 * eviction, and leave the player with six — which would then silently change
 * their draw entry size.
 */
export async function addScore(
  userId: string,
  input: ScoreInput,
): Promise<ScoreResult<{ score: Score; evicted: Score | null }>> {
  const validation = validateScoreInput(input);
  if (!validation.ok) return validation;

  try {
    return await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(scores)
        .where(eq(scores.userId, userId))
        .orderBy(asc(scores.playedOn))
        .for("update"); // lock this user's rows for the duration

      // Checked here for a friendly message; the UNIQUE index is what actually
      // guarantees it under concurrency.
      if (existing.some((row) => row.playedOn === input.playedOn)) {
        return {
          ok: false as const,
          error: "You already logged a round on that date. Edit it instead.",
          field: "playedOn",
        };
      }

      let evicted: Score | null = null;

      // "A new score replaces the oldest stored score automatically" (§05).
      // Evict only when already full, and only the single oldest.
      if (existing.length >= SCORES_RETAINED) {
        const oldest = existing[0];

        // A new round older than everything retained would evict itself, which
        // is surprising rather than helpful. Reject it instead.
        if (input.playedOn <= oldest.playedOn) {
          return {
            ok: false as const,
            error: `That round is older than all ${SCORES_RETAINED} of your retained scores, so it would be dropped immediately.`,
            field: "playedOn",
          };
        }

        await tx.delete(scores).where(eq(scores.id, oldest.id));
        evicted = oldest;
      }

      const [created] = await tx
        .insert(scores)
        .values({
          userId,
          playedOn: input.playedOn,
          points: input.points,
          courseName: input.courseName?.trim() || null,
        })
        .returning();

      return { ok: true as const, data: { score: created, evicted } };
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "You already logged a round on that date.",
        field: "playedOn",
      };
    }
    throw error;
  }
}

/**
 * Edits an existing round.
 *
 * Scoped by user id as well as score id so that a guessed id cannot reach
 * somebody else's row — the `where` is the authorization check.
 */
export async function updateScore(
  userId: string,
  scoreId: string,
  input: ScoreInput,
): Promise<ScoreResult<Score>> {
  const validation = validateScoreInput(input);
  if (!validation.ok) return validation;

  try {
    const [updated] = await db
      .update(scores)
      .set({
        playedOn: input.playedOn,
        points: input.points,
        courseName: input.courseName?.trim() || null,
        updatedAt: new Date(),
      })
      .where(and(eq(scores.id, scoreId), eq(scores.userId, userId)))
      .returning();

    if (!updated) {
      return { ok: false, error: "That score could not be found." };
    }

    return { ok: true, data: updated };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error: "You already have a round logged on that date.",
        field: "playedOn",
      };
    }
    throw error;
  }
}

export async function deleteScore(
  userId: string,
  scoreId: string,
): Promise<ScoreResult<null>> {
  const [deleted] = await db
    .delete(scores)
    .where(and(eq(scores.id, scoreId), eq(scores.userId, userId)))
    .returning({ id: scores.id });

  if (!deleted) return { ok: false, error: "That score could not be found." };

  return { ok: true, data: null };
}

// ---------------------------------------------------------------------------

function validateScoreInput(input: ScoreInput): ScoreResult<null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.playedOn)) {
    return { ok: false, error: "Enter a valid date.", field: "playedOn" };
  }

  // A round cannot have been played tomorrow. Compared as strings in the
  // player's own calendar terms, which avoids a timezone turning "today" into
  // "tomorrow" for anyone east of the server.
  const today = new Date().toISOString().slice(0, 10);
  if (input.playedOn > today) {
    return { ok: false, error: "That date is in the future.", field: "playedOn" };
  }

  if (!Number.isInteger(input.points)) {
    return { ok: false, error: "Enter a whole number.", field: "points" };
  }

  if (input.points < SCORE_MIN || input.points > SCORE_MAX) {
    return {
      ok: false,
      error: `Stableford scores run from ${SCORE_MIN} to ${SCORE_MAX}.`,
      field: "points",
    };
  }

  return { ok: true, data: null };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

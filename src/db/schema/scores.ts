import { sql } from "drizzle-orm";
import {
  check,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { SCORE_MAX, SCORE_MIN } from "@/lib/constants";

import { users } from "./auth";

/**
 * Golf scores — PRD §05.
 *
 * Two rules from the brief are enforced by the database itself rather than by
 * application code, because they are the ones most likely to be violated by a
 * race (two tabs submitting at once) or a future code path that forgets:
 *
 *   1. "Only one score entry is permitted per date"  → UNIQUE (user_id, played_on)
 *   2. "Score range: 1–45 (Stableford format)"       → CHECK on points
 *
 * The third rule — "only the latest 5 scores are retained, a new score replaces
 * the oldest" — cannot be a constraint, so it lives in a single transactional
 * service function (see the score service in Phase 4). Keeping eviction in one
 * place is what stops the retained set from drifting out of sync with the draw
 * entries derived from it.
 */
export const scores = pgTable(
  "scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /**
     * Calendar date the round was played. Stored as a bare DATE in string mode
     * ("YYYY-MM-DD"): a round belongs to a day, not an instant, so timezone
     * conversion would only introduce off-by-one-day bugs.
     */
    playedOn: date("played_on", { mode: "string" }).notNull(),

    /** Stableford points, 1–45. Doubles as this player's draw number. */
    points: integer("points").notNull(),

    /** Optional colour for the dashboard; not used by the draw engine. */
    courseName: text("course_name"),
    notes: text("notes"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scores_user_date_key").on(table.userId, table.playedOn),
    // Supports the hot query: newest-first retained set for one user.
    index("scores_user_played_on_idx").on(table.userId, table.playedOn.desc()),
    check(
      "scores_points_range",
      sql`${table.points} >= ${sql.raw(String(SCORE_MIN))} AND ${table.points} <= ${sql.raw(String(SCORE_MAX))}`,
    ),
  ],
);

export type Score = typeof scores.$inferSelect;
export type NewScore = typeof scores.$inferInsert;

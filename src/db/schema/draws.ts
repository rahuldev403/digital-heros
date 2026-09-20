import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import {
  drawModeEnum,
  drawStatusEnum,
  payoutStatusEnum,
  verificationStatusEnum,
} from "./enums";

/**
 * Monthly draws — PRD §06, §07.
 *
 * A draw is an immutable record of an event, so everything that fed into it is
 * snapshotted onto the row: the pool size, the subscriber count, the tier
 * percentages and the RNG seed. Reports rendered a year later must show what
 * was actually true on the day, not what today's settings would produce.
 */
export const draws = pgTable(
  "draws",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** "YYYY-MM". One draw per calendar month (PRD §06: monthly cadence). */
    periodKey: text("period_key").notNull(),

    /** Human label, e.g. "March 2026 Draw". */
    name: text("name").notNull(),

    status: drawStatusEnum("status").notNull().default("draft"),
    mode: drawModeEnum("mode").notNull().default("random"),

    // --- Number space (snapshotted; see constants.ts for why 1–45 × 5) ---
    numbersPerEntry: integer("numbers_per_entry").notNull(),
    numberMin: integer("number_min").notNull(),
    numberMax: integer("number_max").notNull(),

    /** The drawn numbers. Null until the draw is simulated. */
    winningNumbers: integer("winning_numbers").array(),

    /**
     * Seed for the deterministic RNG. Storing it makes a published draw
     * independently reproducible — anyone can replay the seed and confirm the
     * numbers were not tampered with after entries were known. Without this,
     * "trust us, it was random" is the only assurance on offer.
     */
    randomSeed: text("random_seed"),

    // --- Prize pool arithmetic (PRD §07) ---

    /** Sum of prize-pool contributions from payments in this period. */
    basePoolMinor: integer("base_pool_minor").notNull().default(0),

    /** Unclaimed jackpot carried in from a previous draw. */
    rolloverInMinor: integer("rollover_in_minor").notNull().default(0),

    /** basePoolMinor + rolloverInMinor. */
    totalPoolMinor: integer("total_pool_minor").notNull().default(0),

    /** Jackpot carried out to the next draw when nobody matched 5. */
    rolloverOutMinor: integer("rollover_out_minor").notNull().default(0),

    /**
     * Any minor units left over after splitting tiers among winners. Tracked
     * explicitly so the books balance to the paisa instead of leaking rounding.
     */
    undistributedMinor: integer("undistributed_minor").notNull().default(0),

    currency: text("currency").notNull(),

    /** Active subscriber count at draw time (PRD §07 auto-calculation input). */
    activeSubscriberCount: integer("active_subscriber_count").notNull().default(0),
    entryCount: integer("entry_count").notNull().default(0),

    /** Tier share percentages in force for this draw, as { "5": 4000, ... } bps. */
    tierSharesBps: jsonb("tier_shares_bps").$type<Record<string, number>>(),

    /** When the draw is scheduled to take place. */
    drawDate: timestamp("draw_date", { withTimezone: true }).notNull(),

    simulatedAt: timestamp("simulated_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: uuid("published_by").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("draws_period_key").on(table.periodKey),
    index("draws_status_idx").on(table.status),
    index("draws_draw_date_idx").on(table.drawDate),
  ],
);

/**
 * One entry per eligible subscriber per draw.
 *
 * `numbers` is a *snapshot* of the player's five retained scores taken when the
 * draw is locked. It is not a live join to the scores table: a player must not
 * be able to change their numbers after seeing the result, and equally a player
 * who logs a new round the day after the draw must not retroactively lose.
 */
export const drawEntries = pgTable(
  "draw_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** The player's five numbers, i.e. their retained Stableford scores. */
    numbers: integer("numbers").array().notNull(),

    /** Full score rows behind those numbers (dates, courses) for audit display. */
    scoreSnapshot: jsonb("score_snapshot").$type<
      Array<{ playedOn: string; points: number; courseName: string | null }>
    >(),

    /** Count of matching numbers, filled in at simulation. */
    matchCount: integer("match_count"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("draw_entries_draw_user_key").on(table.drawId, table.userId),
    index("draw_entries_draw_idx").on(table.drawId),
    index("draw_entries_user_idx").on(table.userId),
    index("draw_entries_match_idx").on(table.drawId, table.matchCount),
  ],
);

/**
 * Winners — the join between a draw result and the money owed.
 *
 * Separate from `drawEntries` because a winner has a lifecycle an entry does
 * not: prove it, get reviewed, get paid. Most entries never become winners, so
 * this also keeps the verification workflow querying a small table.
 */
export const drawWinners = pgTable(
  "draw_winners",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    drawId: uuid("draw_id")
      .notNull()
      .references(() => draws.id, { onDelete: "cascade" }),

    entryId: uuid("entry_id")
      .notNull()
      .references(() => drawEntries.id, { onDelete: "cascade" }),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    /** 3, 4 or 5 matched numbers. */
    tier: integer("tier").notNull(),
    matchedNumbers: integer("matched_numbers").array().notNull(),

    // --- Prize arithmetic, snapshotted so a payout is always explainable ---
    tierPoolMinor: integer("tier_pool_minor").notNull(),
    winnersInTier: integer("winners_in_tier").notNull(),
    /** tierPoolMinor split equally across winnersInTier (PRD §07). */
    prizeMinor: integer("prize_minor").notNull(),
    currency: text("currency").notNull(),

    verificationStatus: verificationStatusEnum("verification_status")
      .notNull()
      .default("pending"),

    payoutStatus: payoutStatusEnum("payout_status").notNull().default("pending"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paidBy: uuid("paid_by").references(() => users.id, { onDelete: "set null" }),
    payoutReference: text("payout_reference"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("draw_winners_entry_key").on(table.entryId),
    index("draw_winners_draw_idx").on(table.drawId),
    index("draw_winners_user_idx").on(table.userId),
    index("draw_winners_verification_idx").on(table.verificationStatus),
    index("draw_winners_payout_idx").on(table.payoutStatus),
  ],
);

/**
 * Proof submissions — PRD §09.
 *
 * A separate table rather than columns on `drawWinners` because a rejected
 * winner may submit again, and the review history (who rejected what, and why)
 * has to survive the resubmission.
 */
export const winnerVerifications = pgTable(
  "winner_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    drawWinnerId: uuid("draw_winner_id")
      .notNull()
      .references(() => drawWinners.id, { onDelete: "cascade" }),

    /** Screenshot of scores from the golf platform (PRD §09 PROOF UPLOAD). */
    fileUrl: text("file_url").notNull(),
    fileName: text("file_name"),
    mimeType: text("mime_type"),
    fileSizeBytes: integer("file_size_bytes"),

    /** Optional note from the claimant. */
    note: text("note"),

    status: verificationStatusEnum("status").notNull().default("submitted"),

    reviewedBy: uuid("reviewed_by").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("winner_verifications_winner_idx").on(table.drawWinnerId),
    index("winner_verifications_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export type Draw = typeof draws.$inferSelect;
export type NewDraw = typeof draws.$inferInsert;
export type DrawEntry = typeof drawEntries.$inferSelect;
export type NewDrawEntry = typeof drawEntries.$inferInsert;
export type DrawWinner = typeof drawWinners.$inferSelect;
export type NewDrawWinner = typeof drawWinners.$inferInsert;
export type WinnerVerification = typeof winnerVerifications.$inferSelect;
export type NewWinnerVerification = typeof winnerVerifications.$inferInsert;

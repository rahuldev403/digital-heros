import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "@/lib/constants";

import { charities } from "./charity";
import { userRoleEnum, userStatusEnum } from "./enums";

/**
 * Users — PRD §03.
 *
 * Auth is session-based rather than JWT. The PRD requires a "real-time
 * subscription status check on every authenticated request" (§04 VALIDATION),
 * which a self-contained token cannot provide: a token minted before a payment
 * failed would still assert an active subscription until it expired. Resolving
 * the session against the database on each request makes revocation and
 * subscription state instantaneous, and lets admins force-logout a user.
 */
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Stored lowercased and trimmed; uniqueness is enforced case-insensitively. */
    email: text("email").notNull(),

    /** bcrypt hash. The plaintext password never leaves the request handler. */
    passwordHash: text("password_hash").notNull(),

    fullName: text("full_name").notNull(),

    role: userRoleEnum("role").notNull().default("user"),
    status: userStatusEnum("status").notNull().default("active"),

    /**
     * Chosen charity (PRD §08.1: selected at signup). Nullable because an
     * account exists briefly before the choice is made, and because a charity
     * can be deactivated — `onDelete: "set null"` prompts the user to re-choose
     * rather than silently redirecting their money.
     */
    charityId: uuid("charity_id").references(() => charities.id, {
      onDelete: "set null",
    }),

    /**
     * Whole-percent share of each subscription payment routed to that charity.
     * Floor of 10% is a product rule (PRD §08.1) enforced here as a CHECK so no
     * code path can violate it.
     */
    charityPercent: integer("charity_percent").notNull().default(CHARITY_MIN_PERCENT),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Case-insensitive uniqueness: "Rahul@x.com" and "rahul@x.com" are one account.
    uniqueIndex("users_email_lower_key").on(sql`lower(${table.email})`),
    index("users_role_idx").on(table.role),
    index("users_charity_idx").on(table.charityId),
    check(
      "users_charity_percent_range",
      sql`${table.charityPercent} >= ${sql.raw(String(CHARITY_MIN_PERCENT))} AND ${table.charityPercent} <= ${sql.raw(String(CHARITY_MAX_PERCENT))}`,
    ),
  ],
);

/**
 * Server-side sessions. The cookie carries an opaque random token; only its
 * SHA-256 hash is stored, so a database leak cannot be replayed as a login.
 */
export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 hash of the token held in the client cookie. */
    id: text("id").primaryKey(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

    /** Captured for the admin security view and to help users spot odd logins. */
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sessions_user_idx").on(table.userId),
    index("sessions_expires_idx").on(table.expiresAt),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;

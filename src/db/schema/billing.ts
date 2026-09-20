import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";
import { charities } from "./charity";
import {
  billingIntervalEnum,
  donationStatusEnum,
  paymentStatusEnum,
  subscriptionStatusEnum,
} from "./enums";

/**
 * MONEY REPRESENTATION
 *
 * Every amount in this schema is an integer in the currency's *minor unit*
 * (cents for EUR), never a float or decimal. Percentage splits
 * are stored in basis points (1 bps = 0.01%). This keeps the charity split,
 * prize-pool contribution and tier distribution exact — a repeating fraction
 * like a third of a pool can never silently lose or invent a paisa. Rounding
 * happens once, explicitly, at the point of division, with the remainder
 * accounted for rather than discarded.
 */

// ---------------------------------------------------------------------------
// Plans (PRD §04)
// ---------------------------------------------------------------------------

export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Stable machine identifier: "monthly" | "yearly". */
    code: text("code").notNull(),

    name: text("name").notNull(),
    description: text("description"),

    priceMinor: integer("price_minor").notNull(),
    currency: text("currency").notNull(),

    interval: billingIntervalEnum("interval").notNull(),
    intervalCount: integer("interval_count").notNull().default(1),

    /**
     * Share of each payment on this plan that funds the prize pool (PRD §07).
     * Per-plan rather than global so a yearly plan could contribute differently
     * without a migration.
     */
    prizePoolShareBps: integer("prize_pool_share_bps").notNull(),

    /**
     * Stripe linkage. Nullable so plans can be seeded before Stripe products
     * exist; `npm run stripe:sync` backfills these.
     */
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),

    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("plans_code_key").on(table.code),
    uniqueIndex("plans_stripe_price_key").on(table.stripePriceId),
  ],
);

// ---------------------------------------------------------------------------
// Subscriptions (PRD §04)
// ---------------------------------------------------------------------------

/**
 * A row per subscription attempt, kept forever. A user who cancels and later
 * resubscribes gets a second row, so billing history stays auditable — the
 * admin panel needs "manage subscriptions", not "manage current subscription".
 */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),

    planId: uuid("plan_id")
      .notNull()
      .references(() => plans.id, { onDelete: "restrict" }),

    status: subscriptionStatusEnum("status").notNull().default("incomplete"),

    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),

    /** The window the user has currently paid for; drives access control. */
    currentPeriodStart: timestamp("current_period_start", { withTimezone: true }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true }),

    /** Set when a user cancels but keeps access until the period runs out. */
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    canceledAt: timestamp("canceled_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("subscriptions_stripe_sub_key").on(table.stripeSubscriptionId),
    index("subscriptions_user_idx").on(table.userId),
    index("subscriptions_status_idx").on(table.status),
    index("subscriptions_period_end_idx").on(table.currentPeriodEnd),
  ],
);

// ---------------------------------------------------------------------------
// Payments ledger (PRD §07, §08.1, §11.05)
// ---------------------------------------------------------------------------

/**
 * The financial source of truth.
 *
 * Every successful subscription charge is split here, once, at the moment it is
 * received — and the split is *stored*, not recomputed later. That matters
 * because the inputs drift: a user can change charity or raise their
 * percentage, and a plan's prize-pool share can be retuned. Recomputing
 * historical contributions from today's settings would silently rewrite what
 * past charities were owed. Snapshotting makes every reported total
 * reproducible from immutable rows.
 *
 * Invariant: charityAmountMinor + prizePoolAmountMinor + platformAmountMinor
 *            === amountMinor
 */
export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),

    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),

    stripeInvoiceId: text("stripe_invoice_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),

    /**
     * Draw period this payment funds, as "YYYY-MM". Denormalised from paidAt so
     * the prize pool for a month is a single indexed lookup, and so a late or
     * retried payment can be attributed deliberately rather than by timestamp
     * accident.
     */
    periodKey: text("period_key").notNull(),

    // --- Split snapshot ---
    charityId: uuid("charity_id").references(() => charities.id, {
      onDelete: "set null",
    }),
    charityPercent: integer("charity_percent").notNull(),
    charityAmountMinor: integer("charity_amount_minor").notNull(),

    prizePoolShareBps: integer("prize_pool_share_bps").notNull(),
    prizePoolAmountMinor: integer("prize_pool_amount_minor").notNull(),

    platformAmountMinor: integer("platform_amount_minor").notNull(),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Stripe delivers webhooks at-least-once; this makes replays harmless.
    uniqueIndex("payments_stripe_invoice_key").on(table.stripeInvoiceId),
    index("payments_user_idx").on(table.userId),
    index("payments_period_idx").on(table.periodKey),
    index("payments_charity_idx").on(table.charityId),
    index("payments_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// Donations (PRD §08.1)
// ---------------------------------------------------------------------------

/**
 * "Independent donation option, not tied to gameplay." Deliberately separate
 * from `payments`: donations grant no draw entry and contribute nothing to the
 * prize pool, so mixing them into the ledger would corrupt pool arithmetic.
 * Donor identity is optional — visitors can give without an account.
 */
export const donations = pgTable(
  "donations",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),

    charityId: uuid("charity_id")
      .notNull()
      .references(() => charities.id, { onDelete: "restrict" }),

    donorName: text("donor_name"),
    donorEmail: text("donor_email"),
    message: text("message"),
    isAnonymous: boolean("is_anonymous").notNull().default(false),

    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: donationStatusEnum("status").notNull().default("pending"),

    stripeCheckoutSessionId: text("stripe_checkout_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("donations_stripe_session_key").on(table.stripeCheckoutSessionId),
    index("donations_charity_idx").on(table.charityId),
    index("donations_user_idx").on(table.userId),
    index("donations_status_idx").on(table.status),
  ],
);

// ---------------------------------------------------------------------------
// Relations
// ---------------------------------------------------------------------------

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type Donation = typeof donations.$inferSelect;
export type NewDonation = typeof donations.$inferInsert;

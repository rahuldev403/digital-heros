import { pgEnum } from "drizzle-orm/pg-core";

/**
 * Postgres enums used across the schema.
 *
 * These are real database types rather than free-text columns so that invalid
 * states are impossible at the storage layer, not just in application code.
 */

// --- Identity --------------------------------------------------------------

/** PRD §03 defines three roles, but "public visitor" is simply the absence of a session. */
export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);

export const userStatusEnum = pgEnum("user_status", ["active", "suspended"]);

// --- Billing ---------------------------------------------------------------

export const billingIntervalEnum = pgEnum("billing_interval", ["month", "year"]);

/**
 * Mirrors the subset of Stripe subscription statuses we act on (PRD §04 LIFECYCLE).
 * `expired` is ours, not Stripe's: it marks a subscription whose period has
 * elapsed without renewal, which is what gates feature access.
 */
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "incomplete",
  "active",
  "past_due",
  "canceled",
  "expired",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "succeeded",
  "failed",
  "refunded",
]);

export const donationStatusEnum = pgEnum("donation_status", [
  "pending",
  "succeeded",
  "failed",
]);

// --- Draw engine -----------------------------------------------------------

/**
 * A draw is built up in stages so admins can rehearse it before it is binding
 * (PRD §06 OPERATIONS: "Simulation before publish").
 *
 *   draft     → created, entries not yet frozen
 *   simulated → numbers drawn and winners computed, results NOT visible to users
 *   published → results are final and visible; prizes become claimable
 */
export const drawStatusEnum = pgEnum("draw_status", ["draft", "simulated", "published"]);

/** PRD §06 DRAW LOGIC: plain lottery randomness, or weighted by score frequency. */
export const drawModeEnum = pgEnum("draw_mode", ["random", "algorithmic"]);

// --- Winner verification ---------------------------------------------------

/**
 * PRD §09. Verification applies to winners only.
 *
 *   pending   → winner must upload proof
 *   submitted → awaiting admin review
 *   approved  → cleared for payout
 *   rejected  → winner may submit again
 */
export const verificationStatusEnum = pgEnum("verification_status", [
  "pending",
  "submitted",
  "approved",
  "rejected",
]);

/** PRD §09 PAYMENT STATES: Pending → Paid. */
export const payoutStatusEnum = pgEnum("payout_status", ["pending", "paid"]);

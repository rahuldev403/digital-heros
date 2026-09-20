import { relations } from "drizzle-orm";

import { sessions, users } from "./auth";
import { donations, payments, plans, subscriptions } from "./billing";
import { charities, charityEvents } from "./charity";
import { drawEntries, draws, drawWinners, winnerVerifications } from "./draws";
import { scores } from "./scores";
import { auditLogs } from "./settings";

/**
 * All Drizzle relations live here, in one file, rather than beside their
 * tables.
 *
 * Relations are inherently bidirectional (a user has many payments; a payment
 * belongs to a user), so declaring them next to their tables would force
 * `auth.ts` to import `billing.ts` while `billing.ts` already imports
 * `auth.ts`. Centralising them keeps the table modules a clean one-way
 * dependency graph — enums → charity → auth → billing/scores/draws — with this
 * file as the only place that knows about everything.
 *
 * These power Drizzle's `db.query.*` relational API; plain joins do not need
 * them.
 */

export const usersRelations = relations(users, ({ one, many }) => ({
  charity: one(charities, {
    fields: [users.charityId],
    references: [charities.id],
  }),
  sessions: many(sessions),
  subscriptions: many(subscriptions),
  payments: many(payments),
  donations: many(donations),
  scores: many(scores),
  drawEntries: many(drawEntries),
  wins: many(drawWinners),
  auditLogs: many(auditLogs),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

// --- Charity ---------------------------------------------------------------

export const charitiesRelations = relations(charities, ({ many }) => ({
  events: many(charityEvents),
  supporters: many(users),
  payments: many(payments),
  donations: many(donations),
}));

export const charityEventsRelations = relations(charityEvents, ({ one }) => ({
  charity: one(charities, {
    fields: [charityEvents.charityId],
    references: [charities.id],
  }),
}));

// --- Billing ---------------------------------------------------------------

export const plansRelations = relations(plans, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  user: one(users, { fields: [subscriptions.userId], references: [users.id] }),
  plan: one(plans, { fields: [subscriptions.planId], references: [plans.id] }),
  payments: many(payments),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, { fields: [payments.userId], references: [users.id] }),
  subscription: one(subscriptions, {
    fields: [payments.subscriptionId],
    references: [subscriptions.id],
  }),
  charity: one(charities, {
    fields: [payments.charityId],
    references: [charities.id],
  }),
}));

export const donationsRelations = relations(donations, ({ one }) => ({
  user: one(users, { fields: [donations.userId], references: [users.id] }),
  charity: one(charities, {
    fields: [donations.charityId],
    references: [charities.id],
  }),
}));

// --- Scores ----------------------------------------------------------------

export const scoresRelations = relations(scores, ({ one }) => ({
  user: one(users, { fields: [scores.userId], references: [users.id] }),
}));

// --- Draws -----------------------------------------------------------------

export const drawsRelations = relations(draws, ({ one, many }) => ({
  entries: many(drawEntries),
  winners: many(drawWinners),
  publisher: one(users, {
    fields: [draws.publishedBy],
    references: [users.id],
  }),
}));

export const drawEntriesRelations = relations(drawEntries, ({ one }) => ({
  draw: one(draws, { fields: [drawEntries.drawId], references: [draws.id] }),
  user: one(users, { fields: [drawEntries.userId], references: [users.id] }),
}));

export const drawWinnersRelations = relations(drawWinners, ({ one, many }) => ({
  draw: one(draws, { fields: [drawWinners.drawId], references: [draws.id] }),
  entry: one(drawEntries, {
    fields: [drawWinners.entryId],
    references: [drawEntries.id],
  }),
  user: one(users, { fields: [drawWinners.userId], references: [users.id] }),
  verifications: many(winnerVerifications),
}));

export const winnerVerificationsRelations = relations(winnerVerifications, ({ one }) => ({
  winner: one(drawWinners, {
    fields: [winnerVerifications.drawWinnerId],
    references: [drawWinners.id],
  }),
  reviewer: one(users, {
    fields: [winnerVerifications.reviewedBy],
    references: [users.id],
  }),
}));

// --- Audit -----------------------------------------------------------------

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, { fields: [auditLogs.actorId], references: [users.id] }),
}));

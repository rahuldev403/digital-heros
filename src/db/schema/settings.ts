import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Platform settings — a typed key/value store.
 *
 * Admin-tunable values (default draw mode, prize-pool share, charity floor,
 * homepage spotlight copy) live here rather than in columns so that adding a
 * knob is a write, not a migration. Values are JSONB and validated with Zod at
 * the accessor boundary, so the flexibility does not cost type safety — see
 * `src/lib/settings.ts`.
 */
export const platformSettings = pgTable("platform_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  description: text("description"),

  updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Append-only audit trail.
 *
 * The admin panel can move money (publish a draw, approve a claim, mark a
 * payout paid) and edit user data. Those actions need to be attributable after
 * the fact, so every one of them writes a row here. Never updated or deleted.
 */
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Null for system-initiated actions such as Stripe webhooks. */
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    actorEmail: text("actor_email"),

    /** Dotted verb, e.g. "draw.published", "winner.payout_marked". */
    action: text("action").notNull(),

    entityType: text("entity_type"),
    entityId: text("entity_id"),

    /** Before/after values or request context. */
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),

    ipAddress: text("ip_address"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("audit_logs_actor_idx").on(table.actorId),
    index("audit_logs_action_idx").on(table.action),
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_created_idx").on(table.createdAt.desc()),
  ],
);

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

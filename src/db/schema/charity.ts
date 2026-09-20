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

/**
 * Charity directory — PRD §08.
 *
 * Charitable impact leads the product story, so charities are first-class
 * content records (searchable, filterable, with media and events) rather than a
 * simple dropdown of names.
 */
export const charities = pgTable(
  "charities",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** URL-safe identifier used for public profile routes: /charities/[slug]. */
    slug: text("slug").notNull(),

    name: text("name").notNull(),

    /** One-line hook shown on directory cards. */
    tagline: text("tagline"),

    /** Short paragraph for listing pages. */
    summary: text("summary").notNull(),

    /** Long-form rich description for the profile page. */
    description: text("description").notNull(),

    /** Free-text category powering directory filters (e.g. "Youth", "Health"). */
    category: text("category").notNull(),

    location: text("location"),
    websiteUrl: text("website_url"),
    logoUrl: text("logo_url"),
    coverImageUrl: text("cover_image_url"),

    /** Drives the homepage spotlight section (PRD §08.2 HOMEPAGE). */
    isFeatured: boolean("is_featured").notNull().default(false),

    /**
     * Soft delete. Charities are never hard-deleted once users have contributed
     * to them, because payment ledger rows reference them for reporting.
     */
    isActive: boolean("is_active").notNull().default(true),

    sortOrder: integer("sort_order").notNull().default(0),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("charities_slug_key").on(table.slug),
    index("charities_active_idx").on(table.isActive),
    index("charities_category_idx").on(table.category),
  ],
);

/**
 * Events hosted by a charity — "upcoming events such as golf days" (PRD §08.2).
 */
export const charityEvents = pgTable(
  "charity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    charityId: uuid("charity_id")
      .notNull()
      .references(() => charities.id, { onDelete: "cascade" }),

    title: text("title").notNull(),
    description: text("description"),

    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),

    location: text("location"),
    imageUrl: text("image_url"),
    registrationUrl: text("registration_url"),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("charity_events_charity_idx").on(table.charityId),
    index("charity_events_starts_at_idx").on(table.startsAt),
  ],
);

export type Charity = typeof charities.$inferSelect;
export type NewCharity = typeof charities.$inferInsert;
export type CharityEvent = typeof charityEvents.$inferSelect;
export type NewCharityEvent = typeof charityEvents.$inferInsert;

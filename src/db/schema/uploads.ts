import {
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { users } from "./auth";

/**
 * Binary column type. Drizzle has no built-in `bytea`, so it is declared here
 * once and reused.
 */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Uploaded files, stored in Postgres — PRD §09 PROOF UPLOAD.
 *
 * Winner proof screenshots live in the database rather than in object storage.
 * That is an unusual choice for images and a deliberate one here: these files
 * are rare (only winners upload), small (a capped screenshot), and private
 * (they show someone's identifiable scorecard). Keeping them in Postgres means
 * no second service to provision, the same behaviour on local Docker and on
 * Neon, and — most importantly — access control is a `WHERE` clause rather than
 * a signed-URL scheme that has to be got right.
 *
 * The bytes live in their own table so that listing verifications does not drag
 * megabytes of image data through every query; callers join only when actually
 * serving a file.
 *
 * If volume ever justifies object storage, this table is the seam: the serving
 * route is the only thing that reads `data`.
 */
export const uploads = pgTable(
  "uploads",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    /** Raw file bytes. */
    data: bytea("data").notNull(),

    /**
     * Content type as determined by *us* from the file's magic bytes, never the
     * browser-supplied value — a client can claim anything, and a file served
     * back with an attacker-chosen content type is a stored-XSS vector.
     */
    mimeType: text("mime_type").notNull(),

    /** Original name, for the download filename only. Never used as a path. */
    fileName: text("file_name"),
    sizeBytes: integer("size_bytes").notNull(),

    /**
     * Whether anyone may fetch this file.
     *
     * Defaults to false, so a file is private unless something deliberately
     * publishes it. Charity logos and cover images are public; winner proof
     * screenshots never are, and getting that backwards would expose a named
     * person's scorecard.
     */
    isPublic: boolean("is_public").notNull().default(false),

    uploadedBy: uuid("uploaded_by").references(() => users.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("uploads_uploaded_by_idx").on(table.uploadedBy)],
);

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;

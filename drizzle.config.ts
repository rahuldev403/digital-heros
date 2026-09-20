// Must come first: drizzle-kit runs outside Next.js and does not get its
// automatic .env.local loading.
import "./src/lib/load-env";

import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit configuration.
 *
 * Migrations are generated as SQL files and committed, not pushed ad-hoc. The
 * production database is Neon, where an unreviewed `push` against a live schema
 * is a good way to lose data — generated SQL can be read before it runs.
 */

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
}

export default defineConfig({
  schema: "./src/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // Matches `casing: "snake_case"` on the Drizzle client so generated SQL and
  // runtime queries agree on column naming.
  casing: "snake_case",
  verbose: true,
  strict: true,
});

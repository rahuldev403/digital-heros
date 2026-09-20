import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

/**
 * Applies committed SQL migrations from ./drizzle.
 *
 * Run with `npm run db:migrate`. Drizzle records applied migrations in a
 * `__drizzle_migrations` table, so this is safe to run repeatedly and safe to
 * run against production — it applies only what is missing.
 *
 * This is a standalone script rather than part of the app so that deploys can
 * run migrations as a discrete, reviewable step.
 */
async function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local.");
  }

  const isNeon = url.includes("neon.tech");
  const pool = new Pool({
    connectionString: url,
    ssl: isNeon ? { rejectUnauthorized: true } : false,
    max: 1,
  });

  const target = url.replace(/:\/\/[^@]+@/, "://***@");
  console.log(`Running migrations against ${target}`);

  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./drizzle" });

  console.log("Migrations applied.");
  await pool.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { env } from "@/lib/env";

import * as schema from "./schema";

/**
 * Database client.
 *
 * Deliberately the plain `node-postgres` driver rather than a Neon-specific
 * one. Neon speaks the standard Postgres wire protocol through its pooler
 * endpoint, so the same code and the same connection string format work against
 * local Docker and against production. Swapping environments is a change to
 * DATABASE_URL and nothing else — no driver branch, no second code path to
 * test.
 */

declare global {
  var __dhPool: Pool | undefined;
}

function createPool(): Pool {
  const isNeon = env.DATABASE_URL.includes("neon.tech");

  return new Pool({
    connectionString: env.DATABASE_URL,
    // Neon requires TLS; local Docker does not offer it.
    ssl: isNeon ? { rejectUnauthorized: true } : false,
    // Serverless functions are short-lived and numerous, so each instance keeps
    // a small pool and releases idle connections quickly. Neon's pooler does
    // the real multiplexing.
    max: isNeon ? 5 : 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Next.js dev server re-evaluates modules on every hot reload. Caching the pool
 * on globalThis stops each reload from opening a fresh set of connections until
 * Postgres refuses new ones.
 */
const pool = globalThis.__dhPool ?? createPool();

if (env.NODE_ENV !== "production") {
  globalThis.__dhPool = pool;
}

export const db = drizzle(pool, { schema, casing: "snake_case" });

export type Database = typeof db;

/** Underlying pool, exposed for scripts that need to close it cleanly. */
export { pool };

export * from "./schema";

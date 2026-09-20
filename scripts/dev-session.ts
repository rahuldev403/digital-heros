import "@/lib/load-env";

import { createHash, randomBytes } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { db, pool } from "@/db";
import { sessions, users } from "@/db/schema";

/**
 * Mints a session for a seeded account and prints the cookie value, so a
 * protected page can be fetched with curl during development.
 *
 * Refuses to run against anything but a local database — this hands out a
 * working login for an arbitrary account, which must never be possible against
 * a deployed environment.
 *
 * Usage: npm run dev:session -- admin@digitalheroes.test
 */
async function main() {
  const url = process.env.DATABASE_URL ?? "";

  if (!url.includes("localhost") && !url.includes("127.0.0.1")) {
    throw new Error("Refusing to mint a session against a non-local database.");
  }

  const email = (process.argv[2] ?? "admin@digitalheroes.test").toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (!user) throw new Error(`No user with email ${email}`);

  const token = randomBytes(32).toString("base64url");

  await db.insert(sessions).values({
    id: createHash("sha256").update(token).digest("hex"),
    userId: user.id,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000), // one hour is plenty
    userAgent: "dev-session script",
  });

  console.log(`user   ${user.email} (${user.role})`);
  console.log(`cookie dh_session=${token}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

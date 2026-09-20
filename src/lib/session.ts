import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { eq, lt } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db";
import { sessions } from "@/db/schema";

import { SESSION_COOKIE_NAME, SESSION_TTL_DAYS } from "./constants";
import { env } from "./env";

/**
 * Session management.
 *
 * The cookie carries a 256-bit random token. The database stores only its
 * SHA-256 hash, exactly as a password would be treated — so read access to the
 * sessions table does not hand an attacker a working login for every signed-in
 * user.
 *
 * SHA-256 rather than bcrypt here because the token is already full-entropy
 * random: there is no weak secret to make expensive to guess, and a session
 * lookup happens on every authenticated request, where bcrypt's deliberate
 * slowness would be a self-inflicted denial of service.
 */

const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

/**
 * Re-issue a session's expiry once it is more than halfway through its life.
 * Gives active users a sliding window without writing to the database on every
 * single request.
 */
const REFRESH_THRESHOLD_MS = SESSION_TTL_MS / 2;

/** Hashes a raw token into the value stored as `sessions.id`. */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issues a new session and sets the cookie.
 *
 * Must be called from a Server Action or Route Handler — Server Components are
 * not permitted to write cookies.
 */
export async function createSession(
  userId: string,
  context: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    userAgent: context.userAgent?.slice(0, 500) ?? null,
    ipAddress: context.ipAddress ?? null,
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true, // not readable by JavaScript, so XSS cannot steal it
    secure: env.NODE_ENV === "production", // localhost is plain HTTP
    sameSite: "lax", // survives normal navigation, blocks cross-site POSTs
    path: "/",
    expires: expiresAt,
  });
}

export interface SessionRecord {
  sessionId: string;
  userId: string;
  expiresAt: Date;
}

/**
 * Resolves the current session from the request cookie.
 *
 * Returns null for a missing, unknown or expired cookie — all three are simply
 * "not signed in" from the caller's point of view.
 */
export async function getSessionRecord(): Promise<SessionRecord | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) return null;

  const sessionId = hashToken(token);

  const [row] = await db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);

  if (!row) return null;

  // Expiry is enforced here as well as by the cookie's own lifetime, because a
  // cookie's expiry is set by the client and can simply be edited.
  if (row.expiresAt.getTime() <= Date.now()) {
    await db.delete(sessions).where(eq(sessions.id, row.id));
    return null;
  }

  await maybeExtendSession(row.id, row.expiresAt, token);

  return { sessionId: row.id, userId: row.userId, expiresAt: row.expiresAt };
}

/**
 * Slides the expiry window for an active session.
 *
 * The cookie write is best-effort: this runs during Server Component rendering
 * as well as inside actions, and Next.js forbids setting cookies while
 * rendering. When that happens the database row is still extended, so the
 * session stays alive and the cookie is refreshed on the next action.
 */
async function maybeExtendSession(
  sessionId: string,
  expiresAt: Date,
  token: string,
): Promise<void> {
  const remaining = expiresAt.getTime() - Date.now();

  if (remaining > REFRESH_THRESHOLD_MS) return;

  const nextExpiry = new Date(Date.now() + SESSION_TTL_MS);

  await db
    .update(sessions)
    .set({ expiresAt: nextExpiry })
    .where(eq(sessions.id, sessionId));

  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: nextExpiry,
    });
  } catch {
    // Rendering context — cookie cannot be written. Harmless; see above.
  }
}

/** Signs the current user out: deletes the row and clears the cookie. */
export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    // Delete server-side first. If only the cookie were cleared, the token
    // would remain valid for anyone who had captured it.
    await db.delete(sessions).where(eq(sessions.id, hashToken(token)));
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Revokes every session for a user.
 *
 * Used when a password changes and when an admin suspends an account — in both
 * cases existing sessions must stop working immediately, which is precisely
 * what database-backed sessions make possible.
 */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * Deletes expired rows. Expired sessions are already rejected on read, so this
 * is housekeeping to stop the table growing without bound, not a security
 * control.
 */
export async function pruneExpiredSessions(): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, new Date()))
    .returning({ id: sessions.id });

  return deleted.length;
}

/**
 * Constant-time string comparison, for any future place where a caller-supplied
 * token is compared against a known value. Not needed for session lookup — that
 * is an indexed equality query on a hash — but exported so that comparisons
 * elsewhere are not written with `===`.
 */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  if (bufA.length !== bufB.length) return false;

  return timingSafeEqual(bufA, bufB);
}

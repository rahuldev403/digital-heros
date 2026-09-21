"use server";

import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { charities, users } from "@/db/schema";
import { CHARITY_MIN_PERCENT } from "@/lib/constants";
import { fakePasswordCheck, hashPassword, verifyPassword } from "@/lib/password";
import { createSession, destroySession } from "@/lib/session";
import {
  signInSchema,
  signUpSchema,
  toFieldErrors,
  type AuthActionState,
} from "@/lib/validation/auth";

/**
 * Authentication server actions.
 *
 * These run only on the server, so the password never reaches client
 * JavaScript and the session cookie is set in the same round trip as the
 * credential check.
 */

/** Captures request context for the session record, for the admin security view. */
async function requestContext() {
  const headerList = await headers();

  return {
    userAgent: headerList.get("user-agent"),
    // Behind Vercel's proxy the socket address is the proxy, so the forwarded
    // header is the only view of the real client. First entry is the client;
    // later entries are proxies that appended themselves.
    ipAddress: headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  };
}

/**
 * Only allow redirects to paths inside this app.
 *
 * Without this, `?next=https://evil.example` would turn our own login page into
 * a credible-looking redirect to an attacker's site — the user would arrive
 * there having just typed their password into a page they trusted.
 */
function safeNextPath(next: FormDataEntryValue | null): string | null {
  if (typeof next !== "string" || next.length === 0) return null;

  // Must be a single-slash-prefixed relative path. "//evil.com" and
  // "https://evil.com" are both rejected.
  if (!next.startsWith("/") || next.startsWith("//")) return null;

  return next;
}

// ---------------------------------------------------------------------------
// Sign up
// ---------------------------------------------------------------------------

export async function signUpAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    charityId: formData.get("charityId") || undefined,
    charityPercent: formData.get("charityPercent") ?? CHARITY_MIN_PERCENT,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const { fullName, email, password, charityId, charityPercent } = parsed.data;

  // The id arrives from the client, so confirm it names a charity that is
  // actually accepting supporters. A forged or stale id would otherwise reach
  // the insert and fail on the foreign key as an unhandled error.
  const [charity] = await db
    .select({ id: charities.id })
    .from(charities)
    .where(and(eq(charities.id, charityId), eq(charities.isActive, true)))
    .limit(1);

  if (!charity) {
    return {
      status: "error",
      message: "Please choose one of the listed charities.",
      fieldErrors: { charityId: ["That charity is not available"] },
    };
  }

  const passwordHash = await hashPassword(password);

  let userId: string;

  try {
    const [created] = await db
      .insert(users)
      .values({ fullName, email, passwordHash, charityId, charityPercent })
      .returning({ id: users.id });

    userId = created.id;
  } catch (error) {
    // The case-insensitive unique index on email is the authority on
    // duplicates. Checking first with a SELECT would leave a race between the
    // check and the insert, so we let the database decide and translate the
    // violation into a field error.
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "That email is already registered.",
        fieldErrors: { email: ["An account with this email already exists"] },
      };
    }

    throw error;
  }

  await createSession(userId, await requestContext());

  // New subscribers go straight into the subscribe flow (PRD §12 CTA).
  redirect(safeNextPath(formData.get("next")) ?? "/pricing");
}

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------

export async function signInAction(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
      status: users.status,
    })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (!user) {
    // Spend the time a real bcrypt comparison would take. Returning instantly
    // here would make "no such account" measurably faster than "wrong
    // password", which lets an attacker enumerate who has an account.
    await fakePasswordCheck();
    return invalidCredentials();
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) return invalidCredentials();

  if (user.status === "suspended") {
    return {
      status: "error",
      message: "This account has been suspended. Contact support for help.",
    };
  }

  await createSession(user.id, await requestContext());

  redirect(safeNextPath(formData.get("next")) ?? "/dashboard");
}

/**
 * One message for both "no such user" and "wrong password".
 *
 * Telling the user which of the two failed would confirm to anyone who asks
 * whether a given email has an account here. Membership of a paid platform is
 * not something users agreed to publish.
 */
function invalidCredentials(): AuthActionState {
  return {
    status: "error",
    message: "That email and password combination is not recognised.",
  };
}

// ---------------------------------------------------------------------------
// Sign out
// ---------------------------------------------------------------------------

export async function signOutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Postgres error 23505 — unique_violation. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

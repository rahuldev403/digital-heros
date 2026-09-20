import "server-only";

import { cache } from "react";

import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";

import { db } from "@/db";
import { charities, users } from "@/db/schema";

import { getSessionRecord } from "./session";
import { getSubscriptionState, type SubscriptionState } from "./subscription";

/**
 * Data Access Layer.
 *
 * Every authorization decision in the app goes through this file. The point is
 * that `getCurrentUser()` cannot be called without the session being verified
 * as a side effect — so there is no way to read the current user and forget to
 * check whether they are allowed to be there.
 *
 * Auth checks deliberately live here rather than in layouts: a layout does not
 * re-render on navigation between its own routes, and does not control whether
 * its child segments render at all, so a check placed there can be bypassed.
 */

/**
 * The shape of a user that may cross into a page or component.
 *
 * A Data Transfer Object, not the database row: `passwordHash` exists on the
 * table and must never be within reach of anything that renders. Listing the
 * safe fields explicitly means a column added later is excluded by default
 * rather than leaked by default.
 */
export interface CurrentUser {
  id: string;
  email: string;
  fullName: string;
  role: "user" | "admin";
  status: "active" | "suspended";
  charityId: string | null;
  charityName: string | null;
  charitySlug: string | null;
  charityPercent: number;
  createdAt: Date;
  subscription: SubscriptionState;
}

/**
 * Resolves the signed-in user, or null.
 *
 * Wrapped in React's `cache` so that a page, its nested components and the
 * DAL's own guards share one lookup per request instead of hitting the database
 * once per call site. The cache lasts exactly one render pass, which is what
 * makes the PRD's "real-time" check real: the next request re-reads everything.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await getSessionRecord();

  if (!session) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      fullName: users.fullName,
      role: users.role,
      status: users.status,
      charityId: users.charityId,
      charityName: charities.name,
      charitySlug: charities.slug,
      charityPercent: users.charityPercent,
      createdAt: users.createdAt,
    })
    .from(users)
    .leftJoin(charities, eq(users.charityId, charities.id))
    .where(eq(users.id, session.userId))
    .limit(1);

  if (!row) return null;

  // A suspended account is treated as signed out everywhere, rather than as a
  // signed-in user who fails individual permission checks. That way no feature
  // can accidentally omit the suspension check.
  if (row.status === "suspended") return null;

  const subscription = await getSubscriptionState(row.id);

  return { ...row, subscription };
});

/**
 * Requires a signed-in user, or sends them to sign in.
 *
 * `next` carries the attempted URL so the user lands where they were going
 * instead of on a generic dashboard.
 */
export async function requireUser(next?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) {
    redirect(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
  }

  return user;
}

/**
 * Requires an administrator (PRD §03 ROLE 03).
 *
 * A signed-in non-admin gets a 404, not a 403. Two reasons: it does not confirm
 * to a curious subscriber that an admin surface exists at that URL, and unlike
 * `forbidden()` it uses a stable Next.js API — `forbidden()` is still behind the
 * experimental `authInterrupts` flag, which is not something to build a
 * deliverable on.
 *
 * Signing in is still required first, so an anonymous visitor is sent to the
 * login page rather than being told the route does not exist.
 */
export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser("/admin");

  if (user.role !== "admin") {
    notFound();
  }

  return user;
}

/**
 * Requires an active subscription (PRD §04 ACCESS CONTROL).
 *
 * Non-subscribers are sent to the pricing page rather than shown an error —
 * the PRD wants the subscribe flow to be "prominent and persuasive" (§12 CTA),
 * and a paywall is the most persuasive moment there is.
 */
export async function requireSubscriber(next?: string): Promise<CurrentUser> {
  const user = await requireUser(next);

  if (!user.subscription.hasAccess) {
    redirect(next ? `/pricing?next=${encodeURIComponent(next)}` : "/pricing");
  }

  return user;
}

/** True when an admin is signed in. For conditionally rendering admin UI. */
export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

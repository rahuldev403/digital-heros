"use server";

import { and, desc, eq, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { auditLogs, subscriptions, users } from "@/db/schema";
import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "@/lib/constants";
import { requireAdmin } from "@/lib/dal";
import { cancelSubscription } from "@/lib/services/billing";
import { addScore, deleteScore, updateScore } from "@/lib/services/scores";
import { destroyAllSessionsForUser } from "@/lib/session";
import { emailSchema, toFieldErrors } from "@/lib/validation/auth";

/**
 * User management — PRD §11.01: view and edit user profiles, edit golf scores,
 * manage subscriptions.
 *
 * Score edits go through the same score service members use, so an admin
 * cannot put a user into a state the product rules forbid — six scores, two on
 * one date, a 46. Admin power is over *whose* data changes, not over what the
 * rules are.
 */

export type UserAdminState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

async function audit(
  admin: { id: string; email: string },
  action: string,
  userId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    actorId: admin.id,
    actorEmail: admin.email,
    action,
    entityType: "user",
    entityId: userId,
    metadata,
  });
}

function refresh(userId: string) {
  revalidatePath(`/admin/users/${userId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter a name").max(120),
  email: emailSchema,
  role: z.enum(["user", "admin"]),
  status: z.enum(["active", "suspended"]),
  charityId: z.string().uuid().optional().or(z.literal("")),
  charityPercent: z.coerce
    .number()
    .int()
    .min(CHARITY_MIN_PERCENT, `Minimum is ${CHARITY_MIN_PERCENT}%`)
    .max(CHARITY_MAX_PERCENT, `Maximum is ${CHARITY_MAX_PERCENT}%`),
});

export async function updateUserProfileAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: formData.get("role"),
    status: formData.get("status"),
    charityId: formData.get("charityId") ?? "",
    charityPercent: formData.get("charityPercent"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const data = parsed.data;

  // An admin editing their own account must not be able to demote or suspend
  // themselves — with a single admin that is an unrecoverable lockout, and it
  // is exactly the kind of change made by accident on the wrong row.
  if (userId === admin.id && (data.role !== "admin" || data.status !== "active")) {
    return {
      status: "error",
      message: "You cannot remove your own admin access or suspend yourself.",
    };
  }

  // Never leave the platform with no administrator at all.
  if (data.role !== "admin") {
    const [{ otherAdmins }] = await db
      .select({ otherAdmins: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, userId)));

    const [target] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (target?.role === "admin" && otherAdmins === 0) {
      return { status: "error", message: "This is the last administrator." };
    }
  }

  const [before] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!before) return { status: "error", message: "User not found." };

  try {
    await db
      .update(users)
      .set({
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        status: data.status,
        charityId: data.charityId || null,
        charityPercent: data.charityPercent,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "23505"
    ) {
      return {
        status: "error",
        message: "That email is already in use.",
        fieldErrors: { email: ["Another account uses this email"] },
      };
    }
    throw error;
  }

  // Suspension has to take effect now, not whenever their session happens to
  // expire. Database-backed sessions are what make this possible (decision D4).
  const newlySuspended = before.status === "active" && data.status === "suspended";
  if (newlySuspended) await destroyAllSessionsForUser(userId);

  // Record exactly what changed, not just that something did.
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of ["fullName", "email", "role", "status", "charityId", "charityPercent"] as const) {
    const to = key === "charityId" ? data.charityId || null : data[key];
    if (before[key] !== to) changes[key] = { from: before[key], to };
  }

  await audit(admin, "user.updated", userId, { changes, sessionsRevoked: newlySuspended });
  refresh(userId);

  return {
    status: "success",
    message: newlySuspended
      ? "Saved. The account is suspended and signed out everywhere."
      : "Profile saved.",
  };
}

export async function revokeSessionsAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  await destroyAllSessionsForUser(userId);
  await audit(admin, "user.sessions_revoked", userId);
  refresh(userId);

  return { status: "success", message: "Signed out of every device." };
}

// ---------------------------------------------------------------------------
// Scores (PRD §11.01 "Edit golf scores")
// ---------------------------------------------------------------------------

function readScore(formData: FormData) {
  return {
    playedOn: String(formData.get("playedOn") ?? ""),
    points: Number(formData.get("points")),
    courseName: String(formData.get("courseName") ?? ""),
  };
}

export async function adminAddScoreAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  const result = await addScore(userId, readScore(formData));
  if (!result.ok) return { status: "error", message: result.error };

  await audit(admin, "score.admin_added", userId, {
    playedOn: result.data.score.playedOn,
    points: result.data.score.points,
    evicted: result.data.evicted?.playedOn ?? null,
  });
  refresh(userId);

  return { status: "success", message: "Score added." };
}

export async function adminUpdateScoreAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const scoreId = String(formData.get("scoreId") ?? "");

  const result = await updateScore(userId, scoreId, readScore(formData));
  if (!result.ok) return { status: "error", message: result.error };

  await audit(admin, "score.admin_updated", userId, {
    scoreId,
    playedOn: result.data.playedOn,
    points: result.data.points,
  });
  refresh(userId);

  return { status: "success", message: "Score updated." };
}

export async function adminDeleteScoreAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const scoreId = String(formData.get("scoreId") ?? "");

  const result = await deleteScore(userId, scoreId);
  if (result.ok) await audit(admin, "score.admin_deleted", userId, { scoreId });

  refresh(userId);
}

// ---------------------------------------------------------------------------
// Subscription (PRD §11.01 "Manage subscriptions")
// ---------------------------------------------------------------------------

/**
 * Cancels at period end.
 *
 * A real subscription is cancelled *in Stripe*, and our row is then synced from
 * Stripe's answer — flipping our status alone would leave Stripe charging the
 * card next month. Seeded demo subscriptions have no Stripe object behind them
 * (decision D7), so those are cancelled locally and say so.
 */
export async function adminCancelSubscriptionAction(
  _prev: UserAdminState,
  formData: FormData,
): Promise<UserAdminState> {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription) return { status: "error", message: "No active subscription." };

  if (subscription.cancelAtPeriodEnd) {
    return { status: "error", message: "Already set to cancel at period end." };
  }

  const isSeeded = subscription.stripeSubscriptionId?.startsWith("sub_seed_") ?? true;

  if (isSeeded) {
    await db
      .update(subscriptions)
      .set({ cancelAtPeriodEnd: true, canceledAt: new Date(), updatedAt: new Date() })
      .where(eq(subscriptions.id, subscription.id));
  } else {
    const result = await cancelSubscription(userId);
    if (!result.ok) return { status: "error", message: result.error ?? "Cancel failed." };
  }

  await audit(admin, "subscription.admin_cancelled", userId, {
    subscriptionId: subscription.id,
    viaStripe: !isSeeded,
  });
  refresh(userId);

  return {
    status: "success",
    message: isSeeded
      ? "Set to cancel at period end (demo subscription — no Stripe object)."
      : "Cancelled in Stripe. Access continues until the paid period ends.",
  };
}

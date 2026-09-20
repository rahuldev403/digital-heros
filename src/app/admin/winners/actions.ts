"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs, drawWinners, winnerVerifications } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";

/**
 * Winner verification and payouts — PRD §09, §11.04.
 *
 * The state machine is deliberately strict: a payout can only be marked paid
 * once verification is approved. Money should not be able to leave on the
 * strength of an unreviewed claim, so that rule is enforced here rather than
 * left to the admin remembering the order.
 */

export type WinnerActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

function refresh() {
  revalidatePath("/admin/winners");
  revalidatePath("/admin");
  revalidatePath("/dashboard/draws");
}

export async function reviewClaimAction(
  _prev: WinnerActionState,
  formData: FormData,
): Promise<WinnerActionState> {
  const admin = await requireAdmin();

  const winnerId = String(formData.get("winnerId") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const note = String(formData.get("reviewNote") ?? "").trim() || null;

  if (decision !== "approved" && decision !== "rejected") {
    return { status: "error", message: "Invalid decision." };
  }

  const [winner] = await db
    .select()
    .from(drawWinners)
    .where(eq(drawWinners.id, winnerId))
    .limit(1);

  if (!winner) return { status: "error", message: "Winner not found." };

  if (winner.payoutStatus === "paid") {
    return {
      status: "error",
      message: "This prize has already been paid; the claim cannot be re-reviewed.",
    };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(drawWinners)
      .set({ verificationStatus: decision, updatedAt: new Date() })
      .where(eq(drawWinners.id, winnerId));

    // Stamp the most recent submission with the outcome, if one exists.
    await tx
      .update(winnerVerifications)
      .set({
        status: decision,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        reviewNote: note,
      })
      .where(eq(winnerVerifications.drawWinnerId, winnerId));

    await tx.insert(auditLogs).values({
      actorId: admin.id,
      actorEmail: admin.email,
      action: `winner.${decision}`,
      entityType: "draw_winner",
      entityId: winnerId,
      metadata: { note },
    });
  });

  refresh();

  return {
    status: "success",
    message: decision === "approved" ? "Claim approved." : "Claim rejected.",
  };
}

export async function markPaidAction(
  _prev: WinnerActionState,
  formData: FormData,
): Promise<WinnerActionState> {
  const admin = await requireAdmin();

  const winnerId = String(formData.get("winnerId") ?? "");
  const reference = String(formData.get("payoutReference") ?? "").trim() || null;

  const [winner] = await db
    .select()
    .from(drawWinners)
    .where(eq(drawWinners.id, winnerId))
    .limit(1);

  if (!winner) return { status: "error", message: "Winner not found." };

  if (winner.verificationStatus !== "approved") {
    return {
      status: "error",
      message: "Approve the claim before marking it paid.",
    };
  }

  if (winner.payoutStatus === "paid") {
    return { status: "error", message: "Already marked paid." };
  }

  await db.transaction(async (tx) => {
    await tx
      .update(drawWinners)
      .set({
        payoutStatus: "paid",
        paidAt: new Date(),
        paidBy: admin.id,
        payoutReference: reference,
        updatedAt: new Date(),
      })
      .where(eq(drawWinners.id, winnerId));

    await tx.insert(auditLogs).values({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "winner.payout_marked",
      entityType: "draw_winner",
      entityId: winnerId,
      metadata: { reference, amountMinor: winner.prizeMinor },
    });
  });

  refresh();
  return { status: "success", message: "Marked as paid." };
}

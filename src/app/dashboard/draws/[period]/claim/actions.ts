"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs, drawWinners, draws, uploads, winnerVerifications } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { validateImageUpload } from "@/lib/image-validation";

export type ClaimState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * Submits proof of scores for a winning entry — PRD §09.
 *
 * The winner is resolved from the session and the period, never from a
 * client-supplied winner id: otherwise anyone could attach a file to somebody
 * else's claim by guessing an id.
 */
export async function submitClaimAction(
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const user = await requireUser("/dashboard/draws");

  const periodKey = String(formData.get("periodKey") ?? "");
  const note = String(formData.get("note") ?? "").trim() || null;
  const file = formData.get("proof");

  if (!(file instanceof File)) {
    return { status: "error", message: "Choose a screenshot to upload." };
  }

  // Ownership check: this row is the winner, for this period, belonging to
  // this user. Anything else simply does not match.
  const [winner] = await db
    .select({
      id: drawWinners.id,
      verificationStatus: drawWinners.verificationStatus,
      payoutStatus: drawWinners.payoutStatus,
    })
    .from(drawWinners)
    .innerJoin(draws, eq(drawWinners.drawId, draws.id))
    .where(
      and(
        eq(drawWinners.userId, user.id),
        eq(draws.periodKey, periodKey),
        eq(draws.status, "published"),
      ),
    )
    .limit(1);

  if (!winner) {
    return { status: "error", message: "No winning entry found for that draw." };
  }

  if (winner.verificationStatus === "approved") {
    return { status: "error", message: "This claim has already been approved." };
  }

  if (winner.payoutStatus === "paid") {
    return { status: "error", message: "This prize has already been paid." };
  }

  const validated = await validateImageUpload(file);

  if (!validated.ok) {
    return { status: "error", message: validated.error };
  }

  await db.transaction(async (tx) => {
    const [upload] = await tx
      .insert(uploads)
      .values({
        data: validated.bytes,
        mimeType: validated.mimeType,
        fileName: file.name,
        sizeBytes: validated.bytes.length,
        uploadedBy: user.id,
      })
      .returning({ id: uploads.id });

    // A rejected claim can be resubmitted; the previous submission and its
    // review are kept, so the history survives (PRD §09 allows resubmission).
    await tx.insert(winnerVerifications).values({
      drawWinnerId: winner.id,
      uploadId: upload.id,
      fileName: file.name,
      mimeType: validated.mimeType,
      fileSizeBytes: validated.bytes.length,
      note,
      status: "submitted",
    });

    await tx
      .update(drawWinners)
      .set({ verificationStatus: "submitted", updatedAt: new Date() })
      .where(eq(drawWinners.id, winner.id));

    await tx.insert(auditLogs).values({
      actorId: user.id,
      actorEmail: user.email,
      action: "winner.proof_submitted",
      entityType: "draw_winner",
      entityId: winner.id,
      metadata: { periodKey, sizeBytes: validated.bytes.length },
    });
  });

  revalidatePath("/dashboard/draws");
  revalidatePath("/admin/winners");

  return {
    status: "success",
    message: "Proof submitted. An administrator will review it shortly.",
  };
}

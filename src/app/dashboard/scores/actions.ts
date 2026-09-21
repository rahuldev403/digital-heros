"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/dal";
import { addScore, deleteScore, updateScore } from "@/lib/services/scores";

/**
 * Score server actions — PRD §05.
 *
 * Each one re-resolves the current user through the DAL rather than trusting
 * anything in the form: a server action is a public HTTP endpoint, and a user
 * id submitted by the client is an id the client chose.
 *
 * Entering and editing scores is a subscriber capability (PRD §03 ROLE 02),
 * and non-subscribers get "restricted access to platform features" (§04). So
 * every mutation checks the live subscription — hiding the form is not enough,
 * because the action can be called without the form.
 */

const SUBSCRIBE_MESSAGE =
  "An active subscription is needed to log or change scores. Your existing scores are kept.";

export type ScoreFormState =
  | { status: "idle" }
  | { status: "error"; message: string; field?: string }
  // `token` is a fresh value on every success. The form uses it as a React
  // `key` to remount its fields, which clears them without a setState-in-effect.
  | { status: "success"; message: string; token: string };

export async function addScoreAction(
  _prev: ScoreFormState,
  formData: FormData,
): Promise<ScoreFormState> {
  const user = await requireUser("/dashboard/scores");
  if (!user.subscription.hasAccess) return { status: "error", message: SUBSCRIBE_MESSAGE };

  const result = await addScore(user.id, {
    playedOn: String(formData.get("playedOn") ?? ""),
    points: Number(formData.get("points")),
    courseName: String(formData.get("courseName") ?? ""),
  });

  if (!result.ok) {
    return { status: "error", message: result.error, field: result.field };
  }

  revalidatePath("/dashboard/scores");
  revalidatePath("/dashboard");

  const { evicted } = result.data;

  return {
    status: "success",
    token: crypto.randomUUID(),
    message: evicted
      ? `Round logged. Your ${evicted.points}-point round from ${evicted.playedOn} dropped off.`
      : "Round logged.",
  };
}

export async function updateScoreAction(
  _prev: ScoreFormState,
  formData: FormData,
): Promise<ScoreFormState> {
  const user = await requireUser("/dashboard/scores");
  if (!user.subscription.hasAccess) return { status: "error", message: SUBSCRIBE_MESSAGE };

  const result = await updateScore(user.id, String(formData.get("scoreId") ?? ""), {
    playedOn: String(formData.get("playedOn") ?? ""),
    points: Number(formData.get("points")),
    courseName: String(formData.get("courseName") ?? ""),
  });

  if (!result.ok) {
    return { status: "error", message: result.error, field: result.field };
  }

  revalidatePath("/dashboard/scores");
  revalidatePath("/dashboard");

  return { status: "success", message: "Round updated.", token: crypto.randomUUID() };
}

export async function deleteScoreAction(formData: FormData): Promise<void> {
  const user = await requireUser("/dashboard/scores");
  if (!user.subscription.hasAccess) return;

  await deleteScore(user.id, String(formData.get("scoreId") ?? ""));

  revalidatePath("/dashboard/scores");
  revalidatePath("/dashboard");
}

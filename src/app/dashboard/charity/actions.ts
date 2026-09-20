"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { charities, users } from "@/db/schema";
import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "@/lib/constants";
import { requireUser } from "@/lib/dal";

export type CharityFormState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

/**
 * Updates the user's chosen cause and contribution percentage — PRD §08.1.
 *
 * Changing either affects *future* payments only. Past payments carry their own
 * snapshot of charity and percentage (decision D2), so money already given
 * stays with the charity that received it — which is also what the UI promises.
 */
export async function updateCharityAction(
  _prev: CharityFormState,
  formData: FormData,
): Promise<CharityFormState> {
  const user = await requireUser("/dashboard/charity");

  const charityId = String(formData.get("charityId") ?? "");
  const percent = Number(formData.get("charityPercent"));

  if (!charityId) {
    return { status: "error", message: "Choose a cause." };
  }

  if (!Number.isInteger(percent) || percent < CHARITY_MIN_PERCENT || percent > CHARITY_MAX_PERCENT) {
    return {
      status: "error",
      message: `Contribution must be between ${CHARITY_MIN_PERCENT}% and ${CHARITY_MAX_PERCENT}%.`,
    };
  }

  // Confirm the charity exists and is still accepting supporters, rather than
  // trusting an id posted by the client.
  const [charity] = await db
    .select({ id: charities.id, name: charities.name })
    .from(charities)
    .where(eq(charities.id, charityId))
    .limit(1);

  if (!charity) {
    return { status: "error", message: "That cause is no longer available." };
  }

  await db
    .update(users)
    .set({ charityId: charity.id, charityPercent: percent, updatedAt: new Date() })
    .where(eq(users.id, user.id));

  revalidatePath("/dashboard/charity");
  revalidatePath("/dashboard");

  return {
    status: "success",
    message: `You are now giving ${percent}% to ${charity.name}.`,
  };
}

"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";
import { env } from "@/lib/env";
import { toMinorUnits } from "@/lib/money";
import { createDonationCheckout } from "@/lib/services/donations";
import { isStripeReady } from "@/lib/stripe";

export type DonateState = { status: "idle" } | { status: "error"; message: string };

/**
 * Starts a one-off donation — PRD §08.1.
 *
 * No sign-in required. If someone is signed in the gift is linked to their
 * account so it shows in their giving history; otherwise it stands alone.
 */
export async function startDonationAction(
  _prev: DonateState,
  formData: FormData,
): Promise<DonateState> {
  if (!isStripeReady()) {
    return { status: "error", message: "Payments are not configured here." };
  }

  const user = await getCurrentUser();

  // Amounts arrive in euros from the form and are converted once, here, to
  // integer cents — the only representation stored anywhere (decision D2).
  const amountMajor = Number(formData.get("amount"));

  if (!Number.isFinite(amountMajor) || amountMajor <= 0) {
    return { status: "error", message: "Enter an amount." };
  }

  const text = (key: string, max: number) => {
    const value = String(formData.get(key) ?? "").trim().slice(0, max);
    return value || null;
  };

  const headerList = await headers();
  const origin = headerList.get("origin") ?? env.NEXT_PUBLIC_APP_URL;

  let url: string;

  try {
    const result = await createDonationCheckout({
      charitySlug: String(formData.get("charitySlug") ?? ""),
      amountMinor: toMinorUnits(amountMajor),
      userId: user?.id ?? null,
      donorName: user?.fullName ?? text("donorName", 120),
      donorEmail: user?.email ?? text("donorEmail", 255),
      message: text("message", 500),
      isAnonymous: formData.get("isAnonymous") === "on",
      origin,
    });

    if (!result.ok) return { status: "error", message: result.error };
    url = result.url;
  } catch {
    return { status: "error", message: "Could not start the payment. Try again." };
  }

  // Outside the try: redirect() works by throwing, and a catch would swallow it.
  redirect(url);
}

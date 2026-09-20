"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/dal";
import { env } from "@/lib/env";
import { createCheckoutSession } from "@/lib/services/billing";
import { isStripeReady } from "@/lib/stripe";

export type CheckoutState =
  | { status: "idle" }
  | { status: "error"; message: string };

/**
 * Starts Stripe Checkout.
 *
 * `redirect()` throws a control-flow signal that Next.js catches, so it must be
 * called *outside* the try block — swallowing it in a catch would turn a
 * successful redirect into a generic error message, which is one of the more
 * confusing bugs to track down.
 */
export async function startCheckoutAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const user = await requireUser("/pricing");

  if (!isStripeReady()) {
    return {
      status: "error",
      message: "Payments are not configured on this environment.",
    };
  }

  const planCode = String(formData.get("planCode") ?? "");

  // Prefer the real request origin so Checkout returns to the host the user is
  // actually on (localhost, a preview deployment, or production) rather than a
  // baked-in URL.
  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    (headerList.get("host") ? `https://${headerList.get("host")}` : env.NEXT_PUBLIC_APP_URL);

  let url: string;

  try {
    const result = await createCheckoutSession({
      userId: user.id,
      planCode,
      origin,
    });

    if (!result.ok) return { status: "error", message: result.error };

    url = result.url;
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Could not start checkout.",
    };
  }

  redirect(url);
}

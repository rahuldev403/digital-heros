import "server-only";

import Stripe from "stripe";

import { env } from "./env";

/**
 * Stripe client.
 *
 * Created lazily so the app still boots without keys — the environment schema
 * marks them optional deliberately, so that a developer cloning the repo can
 * run everything except payments. Routes that need Stripe call `getStripe()`
 * and get a clear error rather than an undefined property somewhere deeper.
 */

let client: Stripe | null = null;

export function getStripe(): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local — see `npm run stripe:doctor`.",
    );
  }

  client ??= new Stripe(env.STRIPE_SECRET_KEY, {
    // Every request is tagged so charges are traceable to this app in the
    // Stripe dashboard when an account runs more than one integration.
    appInfo: { name: "Digital Heroes", version: "1.0.0" },
  });

  return client;
}

export function isStripeReady(): boolean {
  return Boolean(env.STRIPE_SECRET_KEY);
}

/**
 * Maps a Stripe subscription status onto ours.
 *
 * Stripe has more states than the product cares about. `trialing` counts as
 * active because the user has access; `unpaid` and `incomplete_expired`
 * collapse to expired because in both cases access has ended and the
 * distinction only matters to billing support.
 */
export function mapStripeStatus(
  status: Stripe.Subscription.Status,
): "incomplete" | "active" | "past_due" | "canceled" | "expired" {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
      return "incomplete";
    case "incomplete_expired":
    case "unpaid":
    case "paused":
      return "expired";
    default:
      return "expired";
  }
}

/**
 * Stripe sends epoch seconds; JavaScript wants milliseconds. Getting this
 * wrong puts every renewal date in 1970, and the subscription-access check
 * compares against it.
 */
export function fromStripeTimestamp(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

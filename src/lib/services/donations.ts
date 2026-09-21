import "server-only";

import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { charities, donations } from "@/db/schema";

import { fromStripeTimestamp, getStripe } from "../stripe";

import type Stripe from "stripe";

/**
 * Independent donations — PRD §08.1: "Independent donation option, not tied to
 * gameplay."
 *
 * Kept separate from subscription billing. A donation grants no draw entry and
 * adds nothing to the prize pool, so it lives in its own `donations` table and
 * never in the `payments` ledger — mixing them would inflate the pool the draw
 * engine divides. Visitors may give without an account.
 */

/** €1 floor keeps card fees below the gift; the ceiling guards typos. */
export const DONATION_MIN_MINOR = 100;
export const DONATION_MAX_MINOR = 1_000_000;

export interface DonationRequest {
  charitySlug: string;
  amountMinor: number;
  userId: string | null;
  donorName: string | null;
  donorEmail: string | null;
  message: string | null;
  isAnonymous: boolean;
  origin: string;
}

export type DonationResult = { ok: true; url: string } | { ok: false; error: string };

/** Validates the amount and resolves the charity. */
async function resolveCharity(request: DonationRequest) {
  if (!Number.isInteger(request.amountMinor) || request.amountMinor < DONATION_MIN_MINOR) {
    return { error: "The minimum donation is €1." } as const;
  }

  if (request.amountMinor > DONATION_MAX_MINOR) {
    return { error: "For gifts over €10,000, please contact us directly." } as const;
  }

  const [charity] = await db
    .select({ id: charities.id, name: charities.name, slug: charities.slug })
    .from(charities)
    .where(and(eq(charities.slug, request.charitySlug), eq(charities.isActive, true)))
    .limit(1);

  if (!charity) return { error: "That charity is not accepting donations." } as const;

  return { charity } as const;
}

/**
 * Records the pending donation, then opens a one-off Stripe Checkout for it.
 *
 * The row is written first so the session can carry our id in its metadata —
 * that is how the return page and the webhook find this exact donation.
 */
export async function createDonationCheckout(
  request: DonationRequest,
): Promise<DonationResult> {
  const resolved = await resolveCharity(request);
  if ("error" in resolved) return { ok: false, error: resolved.error ?? "Invalid request." };

  const { charity } = resolved;
  const currency = (process.env.NEXT_PUBLIC_CURRENCY ?? "EUR").toLowerCase();

  const [donation] = await db
    .insert(donations)
    .values({
      userId: request.userId,
      charityId: charity.id,
      donorName: request.donorName,
      donorEmail: request.donorEmail,
      message: request.message,
      isAnonymous: request.isAnonymous,
      amountMinor: request.amountMinor,
      currency: currency.toUpperCase(),
      status: "pending",
    })
    .returning({ id: donations.id });

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: request.amountMinor,
          product_data: { name: `Donation to ${charity.name}` },
        },
      },
    ],
    // `kind` lets the webhook tell a donation apart from a subscription
    // checkout without guessing from the session mode alone.
    metadata: { kind: "donation", donationId: donation.id, charityId: charity.id },
    success_url: `${request.origin}/charities/${charity.slug}/donate/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${request.origin}/charities/${charity.slug}/donate?cancelled=1`,
  });

  await db
    .update(donations)
    .set({ stripeCheckoutSessionId: session.id })
    .where(eq(donations.id, donation.id));

  if (!session.url) return { ok: false, error: "Stripe did not return a checkout URL." };

  return { ok: true, url: session.url };
}

/**
 * Marks a donation paid from its completed Checkout session.
 *
 * Called from both the thank-you page and the webhook, so it must be
 * idempotent: a donation already marked succeeded is left alone, and the
 * update is scoped to the pending row so a replay cannot flip anything else.
 */
export async function settleDonationSession(
  session: Stripe.Checkout.Session,
): Promise<{ settled: boolean }> {
  if (session.metadata?.kind !== "donation") return { settled: false };
  if (session.payment_status !== "paid") return { settled: false };

  const donationId = session.metadata.donationId;
  if (!donationId) return { settled: false };

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const updated = await db
    .update(donations)
    .set({
      status: "succeeded",
      stripePaymentIntentId: paymentIntentId,
      paidAt: fromStripeTimestamp(session.created) ?? new Date(),
    })
    .where(and(eq(donations.id, donationId), eq(donations.status, "pending")))
    .returning({ id: donations.id });

  return { settled: updated.length > 0 };
}

/** Looks up a session by id and settles it — used by the thank-you page. */
export async function settleDonationById(sessionId: string) {
  const session = await getStripe().checkout.sessions.retrieve(sessionId);
  const result = await settleDonationSession(session);

  return { ...result, session };
}

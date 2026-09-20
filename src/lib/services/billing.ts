import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { payments, plans, subscriptions, users } from "@/db/schema";

import { splitSubscriptionPayment } from "../money";
import { toPeriodKey } from "../period";
import { fromStripeTimestamp, getStripe, mapStripeStatus } from "../stripe";

import type Stripe from "stripe";

/**
 * Subscription billing — PRD §04.
 *
 * Both the Checkout return path and the webhook handler funnel into
 * `syncSubscriptionFromStripe`, so there is exactly one piece of code that
 * turns a Stripe subscription into our rows. Two implementations would drift,
 * and the one that ran less often would be the buggy one.
 */

/** Finds or creates the Stripe customer for a user. */
export async function ensureStripeCustomer(userId: string): Promise<string> {
  const stripe = getStripe();

  const [existing] = await db
    .select({ customerId: subscriptions.stripeCustomerId })
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  // Seeded rows carry placeholder ids that do not exist in Stripe (decision
  // D7), so they must not be reused as real customers.
  if (existing?.customerId && !existing.customerId.startsWith("cus_seed_")) {
    return existing.customerId;
  }

  const [user] = await db
    .select({ email: users.email, fullName: users.fullName })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) throw new Error("User not found");

  const customer = await stripe.customers.create({
    email: user.email,
    name: user.fullName,
    // Lets a Stripe-side event be traced back to our user without a lookup
    // table, and survives an email change.
    metadata: { userId },
  });

  return customer.id;
}

/**
 * Starts Checkout for a plan and returns the URL to send the user to.
 */
export async function createCheckoutSession(params: {
  userId: string;
  planCode: string;
  origin: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const stripe = getStripe();

  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.code, params.planCode), eq(plans.isActive, true)))
    .limit(1);

  if (!plan) return { ok: false, error: "That plan is not available." };

  if (!plan.stripePriceId) {
    return {
      ok: false,
      error: "This plan is not connected to Stripe yet. Run `npm run stripe:sync`.",
    };
  }

  const customerId = await ensureStripeCustomer(params.userId);

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    // Returning with the session id lets us reconcile immediately rather than
    // waiting on a webhook, so the user sees an active subscription the moment
    // they land back (webhooks still handle renewals and cancellations).
    success_url: `${params.origin}/subscribe/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${params.origin}/pricing?cancelled=1`,
    subscription_data: {
      metadata: { userId: params.userId, planId: plan.id, planCode: plan.code },
    },
    metadata: { userId: params.userId, planId: plan.id, planCode: plan.code },
    allow_promotion_codes: true,
  });

  if (!session.url) return { ok: false, error: "Stripe did not return a checkout URL." };

  return { ok: true, url: session.url };
}

/**
 * Writes a Stripe subscription into our tables.
 *
 * Idempotent, because it is called from both the Checkout return and the
 * webhook — and Stripe delivers webhooks at least once, so it will genuinely
 * run more than once for the same subscription.
 */
export async function syncSubscriptionFromStripe(
  stripeSubscription: Stripe.Subscription,
): Promise<void> {
  const metadata = stripeSubscription.metadata ?? {};
  const userId = metadata.userId;

  if (!userId) return; // not one of ours

  // Resolve the plan from the price rather than trusting metadata alone, so a
  // plan change made in Stripe is reflected correctly.
  const priceId = stripeSubscription.items.data[0]?.price?.id;

  const [plan] = priceId
    ? await db.select().from(plans).where(eq(plans.stripePriceId, priceId)).limit(1)
    : [];

  const resolvedPlan =
    plan ??
    (metadata.planId
      ? (await db.select().from(plans).where(eq(plans.id, metadata.planId)).limit(1))[0]
      : undefined);

  if (!resolvedPlan) return;

  const item = stripeSubscription.items.data[0];

  const values = {
    userId,
    planId: resolvedPlan.id,
    status: mapStripeStatus(stripeSubscription.status),
    stripeCustomerId:
      typeof stripeSubscription.customer === "string"
        ? stripeSubscription.customer
        : stripeSubscription.customer.id,
    stripeSubscriptionId: stripeSubscription.id,
    currentPeriodStart: fromStripeTimestamp(item?.current_period_start),
    currentPeriodEnd: fromStripeTimestamp(item?.current_period_end),
    cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
    canceledAt: fromStripeTimestamp(stripeSubscription.canceled_at),
    endedAt: fromStripeTimestamp(stripeSubscription.ended_at),
    updatedAt: new Date(),
  };

  // The unique index on stripe_subscription_id makes this an upsert rather
  // than a check-then-write, which would race with a concurrent webhook.
  await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: values,
    });
}

/**
 * Records a paid invoice in the ledger, split three ways — PRD §07, §08.1.
 *
 * The split uses the user's charity settings *at the time of payment*, and the
 * result is stored rather than recomputed later (decision D2).
 */
export async function recordInvoicePayment(invoice: Stripe.Invoice): Promise<void> {
  if (invoice.status !== "paid" || !invoice.id) return;

  const subscriptionId =
    typeof invoice.parent?.subscription_details?.subscription === "string"
      ? invoice.parent.subscription_details.subscription
      : invoice.parent?.subscription_details?.subscription?.id;

  if (!subscriptionId) return; // one-off invoice, not a subscription charge

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!subscription) return;

  const [user] = await db
    .select({ charityId: users.charityId, charityPercent: users.charityPercent })
    .from(users)
    .where(eq(users.id, subscription.userId))
    .limit(1);

  if (!user) return;

  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.id, subscription.planId))
    .limit(1);

  const amountMinor = invoice.amount_paid;
  const paidAt = fromStripeTimestamp(invoice.status_transitions?.paid_at) ?? new Date();

  const split = splitSubscriptionPayment({
    amountMinor,
    charityPercent: user.charityPercent,
    prizePoolShareBps: plan?.prizePoolShareBps ?? 3000,
  });

  await db
    .insert(payments)
    .values({
      userId: subscription.userId,
      subscriptionId: subscription.id,
      stripeInvoiceId: invoice.id,
      stripePaymentIntentId: null,
      amountMinor,
      currency: invoice.currency.toUpperCase(),
      status: "succeeded",
      // The period a payment funds is the month it was taken in.
      periodKey: toPeriodKey(paidAt),
      charityId: user.charityId,
      charityPercent: split.charityPercent,
      charityAmountMinor: split.charityAmountMinor,
      prizePoolShareBps: plan?.prizePoolShareBps ?? 3000,
      prizePoolAmountMinor: split.prizePoolAmountMinor,
      platformAmountMinor: split.platformAmountMinor,
      paidAt,
    })
    // The unique index on stripe_invoice_id is what makes webhook redelivery
    // harmless: a replayed event cannot double-count money into the pool.
    .onConflictDoNothing({ target: payments.stripeInvoiceId });
}

/**
 * Reconciles a completed Checkout session immediately on return.
 *
 * Without this the user would land back on a page still saying "no
 * subscription" until the webhook arrived, which on a cold serverless function
 * can be seconds — long enough to look broken and prompt a second payment.
 */
export async function reconcileCheckoutSession(
  sessionId: string,
): Promise<{ ok: boolean; error?: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription", "invoice"],
  });

  if (session.status !== "complete") {
    return { ok: false, error: "That checkout was not completed." };
  }

  const subscription = session.subscription;

  if (subscription && typeof subscription !== "string") {
    await syncSubscriptionFromStripe(subscription);
  }

  const invoice = session.invoice;

  if (invoice && typeof invoice !== "string") {
    await recordInvoicePayment(invoice);
  }

  return { ok: true };
}

/** Cancels at period end — the user keeps what they paid for (PRD §04). */
export async function cancelSubscription(
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const stripe = getStripe();

  const [subscription] = await db
    .select()
    .from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active")))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);

  if (!subscription?.stripeSubscriptionId) {
    return { ok: false, error: "No active subscription to cancel." };
  }

  if (subscription.stripeSubscriptionId.startsWith("sub_seed_")) {
    return {
      ok: false,
      error: "This is seeded demo data and has no Stripe subscription behind it.",
    };
  }

  const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  await syncSubscriptionFromStripe(updated);

  return { ok: true };
}

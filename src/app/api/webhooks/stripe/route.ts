import { NextResponse, type NextRequest } from "next/server";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { env } from "@/lib/env";
import { recordInvoicePayment, syncSubscriptionFromStripe } from "@/lib/services/billing";
import { getStripe } from "@/lib/stripe";

import type Stripe from "stripe";

/**
 * Stripe webhook — PRD §04 LIFECYCLE.
 *
 * This is the only thing that knows about renewals, failed payments and
 * cancellations made outside our UI, so it is what keeps subscription state
 * true over time. The Checkout return path handles the first payment for
 * immediacy; everything after that arrives here.
 *
 * Runs on Node rather than Edge because signature verification and the database
 * client both need Node APIs.
 */
export const runtime = "nodejs";

/** Events we act on. Anything else is acknowledged and ignored. */
const HANDLED = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
]);

export async function POST(request: NextRequest) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is not configured." },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  // Signature verification needs the exact bytes Stripe signed, so the body is
  // read as raw text. Parsing it as JSON first would re-serialise it and the
  // signature would no longer match.
  const payload = await request.text();

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      payload,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (error) {
    // An unverified payload is an unauthenticated request claiming to be
    // Stripe. Never act on it.
    const message = error instanceof Error ? error.message : "Invalid signature";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!HANDLED.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  try {
    await handleEvent(event);
  } catch (error) {
    console.error(`Stripe webhook ${event.type} failed:`, error);

    // A 500 tells Stripe to retry. Every handler below is idempotent, so a
    // retry is safe — and losing a renewal event silently is far worse than
    // processing one twice.
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;

      if (session.mode !== "subscription" || !session.subscription) break;

      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription.id;

      // Re-fetch rather than trusting the embedded object: the event payload is
      // a snapshot from when the event was created, and may already be stale.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscriptionFromStripe(subscription);
      break;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscriptionFromStripe(event.data.object);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object;

      await recordInvoicePayment(invoice);

      // A renewal extends the period, so the subscription row needs updating
      // too — otherwise access would lapse at the old period end.
      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionFromStripe(subscription);
      }
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;

      const subscriptionId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : invoice.parent?.subscription_details?.subscription?.id;

      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionFromStripe(subscription);
      }
      break;
    }
  }

  // Webhooks act on money with no human in the loop, so each one is recorded.
  await db.insert(auditLogs).values({
    actorId: null,
    actorEmail: "stripe-webhook",
    action: `stripe.${event.type}`,
    entityType: "stripe_event",
    entityId: event.id,
    metadata: { type: event.type },
  });
}

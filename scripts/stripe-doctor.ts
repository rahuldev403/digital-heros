// Must come first: it populates process.env before anything reads it.
import "@/lib/load-env";

import Stripe from "stripe";

/**
 * Stripe configuration diagnostic.
 *
 * Read-only. Reports what the connected Stripe account actually is — country,
 * default currency, enabled capabilities, existing products — so that plan
 * pricing can be matched to what the account can genuinely charge, rather than
 * to an assumption that only fails at checkout.
 *
 * Run with `npm run stripe:doctor`.
 */

/** Currencies for which we already know the recurring-payment story. */
const CURRENCY_NOTES: Record<string, string> = {
  eur: "Straightforward for recurring card payments (SEPA region).",
  gbp: "Straightforward for recurring card payments.",
  usd: "Straightforward for recurring card payments.",
  inr: "Indian accounts require RBI e-mandates for recurring charges, which changes the subscription flow.",
};

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    console.error("STRIPE_SECRET_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }

  if (!key.startsWith("sk_test_")) {
    console.error(
      "STRIPE_SECRET_KEY is not a test key (expected an `sk_test_` prefix).\n" +
        "Refusing to run against live mode.",
    );
    process.exit(1);
  }

  const stripe = new Stripe(key);

  // `retrieveCurrent` is the endpoint for "the account this key belongs to".
  // `accounts.retrieve(id)` is for Connect platforms inspecting sub-accounts.
  const account = await stripe.accounts.retrieveCurrent();

  const currency = (account.default_currency ?? "").toLowerCase();

  console.log("=== Stripe account ===");
  console.log("  mode              : test");
  console.log("  country           :", account.country);
  console.log("  default currency  :", currency.toUpperCase() || "(unset)");
  console.log("  charges enabled   :", account.charges_enabled);
  console.log("  payouts enabled   :", account.payouts_enabled);
  console.log("  details submitted :", account.details_submitted);

  const capabilities = Object.entries(account.capabilities ?? {})
    .filter(([, status]) => status === "active")
    .map(([name]) => name);

  console.log(
    "  active capabilities:",
    capabilities.length ? capabilities.join(", ") : "(none reported)",
  );

  const note = CURRENCY_NOTES[currency];
  if (note) {
    console.log(`\n  Recurring payments in ${currency.toUpperCase()}: ${note}`);
  }

  console.log("\n=== Existing objects ===");

  const [products, prices] = await Promise.all([
    stripe.products.list({ limit: 20 }),
    stripe.prices.list({ limit: 20, expand: ["data.product"] }),
  ]);

  console.log(`  products: ${products.data.length}`);
  console.log(`  prices  : ${prices.data.length}`);

  for (const price of prices.data) {
    const product =
      typeof price.product === "object" && "name" in price.product
        ? price.product.name
        : String(price.product);

    const recurrence = price.recurring
      ? `every ${price.recurring.interval_count} ${price.recurring.interval}`
      : "one-time";

    console.log(
      `    - ${product}: ${price.currency.toUpperCase()} ` +
        `${((price.unit_amount ?? 0) / 100).toFixed(2)} (${recurrence})`,
    );
  }

  console.log("\n=== Webhook forwarding ===");
  console.log(
    process.env.STRIPE_WEBHOOK_SECRET
      ? "  STRIPE_WEBHOOK_SECRET is set."
      : "  STRIPE_WEBHOOK_SECRET is NOT set.\n" +
          "  Run: stripe listen --forward-to localhost:3000/api/webhooks/stripe\n" +
          "  then copy the printed whsec_… value into .env.local.",
  );

  // `charges_enabled: false` on an account that has not submitted business
  // details is expected — but it is ambiguous, because the same flag is what
  // blocks a *live* account from charging. Rather than assume test mode is
  // exempt, actually attempt the thing we need in Phase 2 and see.
  if (process.argv.includes("--probe-checkout")) {
    console.log("\n=== Checkout probe ===");
    await probeCheckout(stripe, currency);
  } else {
    console.log("\n  Run with --probe-checkout to verify Checkout actually works.");
  }
}

/**
 * Creates a throwaway recurring price and a Checkout Session against it, to
 * confirm this account can genuinely start a subscription. The price is
 * deactivated immediately afterwards; the session expires by itself.
 */
async function probeCheckout(stripe: Stripe, currency: string): Promise<void> {
  let priceId: string | undefined;

  try {
    const price = await stripe.prices.create({
      currency,
      unit_amount: 999,
      recurring: { interval: "month" },
      product_data: { name: "[probe] delete me" },
    });

    priceId = price.id;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: price.id, quantity: 1 }],
      success_url: "http://localhost:3000/probe-success",
      cancel_url: "http://localhost:3000/probe-cancel",
    });

    console.log("  Checkout session created OK:", session.id.slice(0, 20) + "…");
    console.log("  → This account CAN start subscriptions in test mode.");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.log("  Checkout session FAILED:", message);
    console.log("  → Stripe onboarding likely needs completing before Phase 2.");
  } finally {
    // Leave no clutter behind in the account.
    if (priceId) {
      await stripe.prices.update(priceId, { active: false }).catch(() => {});
    }
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("\nStripe check failed:", message);
  process.exit(1);
});

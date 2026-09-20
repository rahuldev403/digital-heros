import "@/lib/load-env";

import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { plans } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { getStripe } from "@/lib/stripe";

/**
 * Creates the Stripe products and prices for each plan in the database, and
 * writes the resulting ids back.
 *
 * Idempotent: a plan that already has a live price with the right amount,
 * currency and interval is left alone. Prices in Stripe are immutable, so a
 * price change creates a new price and archives the old one — existing
 * subscribers keep billing at the price they signed up on, which is the
 * behaviour you want and the reason we never mutate a price in place.
 *
 * Usage: npm run stripe:sync
 */
async function main() {
  const stripe = getStripe();

  const planRows = await db.select().from(plans).where(eq(plans.isActive, true));

  if (planRows.length === 0) {
    throw new Error("No active plans found. Run `npm run db:seed` first.");
  }

  for (const plan of planRows) {
    console.log(`\n${plan.name} — ${formatMoney(plan.priceMinor, plan.currency)}/${plan.interval}`);

    // --- Product ---
    let productId = plan.stripeProductId;

    if (productId) {
      try {
        const existing = await stripe.products.retrieve(productId);
        if (existing.deleted) productId = null;
      } catch {
        // Stored id refers to a product in another account or a deleted one.
        productId = null;
      }
    }

    if (!productId) {
      const product = await stripe.products.create({
        name: `Digital Heroes — ${plan.name}`,
        description: plan.description ?? undefined,
        metadata: { planCode: plan.code },
      });
      productId = product.id;
      console.log(`  product  created ${productId}`);
    } else {
      console.log(`  product  reusing ${productId}`);
    }

    // --- Price ---
    let priceId = plan.stripePriceId;
    let priceIsCurrent = false;

    if (priceId) {
      try {
        const existing = await stripe.prices.retrieve(priceId);
        priceIsCurrent =
          existing.active &&
          existing.unit_amount === plan.priceMinor &&
          existing.currency === plan.currency.toLowerCase() &&
          existing.recurring?.interval === plan.interval;
      } catch {
        priceIsCurrent = false;
      }
    }

    if (!priceIsCurrent) {
      const price = await stripe.prices.create({
        product: productId,
        unit_amount: plan.priceMinor,
        currency: plan.currency.toLowerCase(),
        recurring: { interval: plan.interval },
        metadata: { planCode: plan.code },
      });

      // Archive the superseded price so it stops appearing in the dashboard,
      // without affecting anyone already subscribed at that price.
      if (priceId && priceId !== price.id) {
        await stripe.prices.update(priceId, { active: false }).catch(() => {});
        console.log(`  price    archived ${priceId}`);
      }

      priceId = price.id;
      console.log(`  price    created ${priceId}`);
    } else {
      console.log(`  price    reusing ${priceId}`);
    }

    await db
      .update(plans)
      .set({ stripeProductId: productId, stripePriceId: priceId, updatedAt: new Date() })
      .where(eq(plans.id, plan.id));
  }

  console.log("\nPlans synced to Stripe.\n");
}

main()
  .catch((error) => {
    console.error("\nStripe sync failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

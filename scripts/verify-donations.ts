import "@/lib/load-env";

import { eq, sql } from "drizzle-orm";

import { db, pool } from "@/db";
import { charities, donations, payments } from "@/db/schema";
import { currentPeriodKey } from "@/lib/period";
import { calculatePool } from "@/lib/services/draws";
import { createDonationCheckout, settleDonationSession } from "@/lib/services/donations";
import { getStripe } from "@/lib/stripe";

import type Stripe from "stripe";

/**
 * Donation checks — PRD §08.1.
 *
 * The property that matters most is the negative one: a donation must never
 * touch the payments ledger or the prize pool. That is asserted directly.
 *
 * Usage: npm run verify:donations
 */

let failures = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
};

async function main() {
  const [charity] = await db
    .select({ slug: charities.slug, id: charities.id })
    .from(charities)
    .where(eq(charities.isActive, true))
    .limit(1);

  const ledgerBefore = await db.select({ n: sql<number>`count(*)::int` }).from(payments);
  const poolBefore = await calculatePool(currentPeriodKey());

  console.log("\n=== Checkout (anonymous donor) ===");
  const result = await createDonationCheckout({
    charitySlug: charity.slug,
    amountMinor: 2500,
    userId: null,
    donorName: null,
    donorEmail: null,
    message: "verification gift",
    isAnonymous: true,
    origin: "http://localhost:3000",
  });

  check("session created without an account", result.ok, result.ok ? "" : result.error);

  const [row] = await db
    .select()
    .from(donations)
    .where(eq(donations.message, "verification gift"))
    .orderBy(sql`${donations.createdAt} desc`)
    .limit(1);

  check("pending donation row recorded", row?.status === "pending");
  check("row linked to its Stripe session", Boolean(row?.stripeCheckoutSessionId));

  if (row?.stripeCheckoutSessionId) {
    const session = await getStripe().checkout.sessions.retrieve(row.stripeCheckoutSessionId);
    check("one-off payment mode, not subscription", session.mode === "payment");
    check("amount is €25.00", session.amount_total === 2500, String(session.amount_total));
    check("currency EUR", session.currency === "eur");
    check("tagged kind=donation", session.metadata?.kind === "donation");
  }

  console.log("\n=== Validation ===");
  const tooSmall = await createDonationCheckout({
    charitySlug: charity.slug, amountMinor: 50, userId: null, donorName: null,
    donorEmail: null, message: null, isAnonymous: false, origin: "http://localhost:3000",
  });
  check("below €1 refused", !tooSmall.ok);

  const unknown = await createDonationCheckout({
    charitySlug: "no-such-charity", amountMinor: 1000, userId: null, donorName: null,
    donorEmail: null, message: null, isAnonymous: false, origin: "http://localhost:3000",
  });
  check("unknown charity refused", !unknown.ok);

  console.log("\n=== Settlement is idempotent ===");
  if (row) {
    // Shaped like the session Stripe sends once the card is charged.
    const paidSession = {
      metadata: { kind: "donation", donationId: row.id },
      payment_status: "paid",
      payment_intent: "pi_verification",
      created: Math.floor(Date.now() / 1000),
    } as unknown as Stripe.Checkout.Session;

    const first = await settleDonationSession(paidSession);
    const second = await settleDonationSession(paidSession);

    check("first settlement marks it paid", first.settled);
    check("replayed settlement is a no-op", !second.settled);

    const [after] = await db.select().from(donations).where(eq(donations.id, row.id));
    check("donation now succeeded", after.status === "succeeded");
  }

  console.log("\n=== Never touches the prize pool ===");
  const ledgerAfter = await db.select({ n: sql<number>`count(*)::int` }).from(payments);
  const poolAfter = await calculatePool(currentPeriodKey());

  check("no payments-ledger row created", ledgerAfter[0].n === ledgerBefore[0].n,
    `${ledgerBefore[0].n} → ${ledgerAfter[0].n}`);
  check("prize pool unchanged", poolAfter.totalMinor === poolBefore.totalMinor,
    `${poolBefore.totalMinor} → ${poolAfter.totalMinor}`);

  // Remove only the row this script created. The rejected validation calls
  // never insert, and a blanket delete would wipe real donors' pending gifts.
  if (row) await db.delete(donations).where(eq(donations.id, row.id));

  console.log(failures === 0 ? "\nAll donation checks passed.\n" : `\n${failures} FAILED.\n`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

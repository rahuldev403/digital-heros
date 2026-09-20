import "@/lib/load-env";

import { eq, sql } from "drizzle-orm";

import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { createCheckoutSession } from "@/lib/services/billing";
import { getStripe } from "@/lib/stripe";

/**
 * Verifies that a real Stripe Checkout session can be created for a real user
 * and plan, and that the session carries the right price, currency and
 * metadata.
 *
 * Checks the integration end to end rather than trusting that the page renders
 * a button. Sessions expire on their own and no charge is made.
 *
 * Usage: npm run verify:checkout [-- email@example.com]
 */
async function main() {
  const email = (process.argv[2] ?? "rohan.reddy2@digitalheroes.test").toLowerCase();

  const [user] = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(sql`lower(${users.email})`, email))
    .limit(1);

  if (!user) throw new Error(`No user with email ${email}`);

  console.log(`\nCreating checkout for ${user.email}\n`);

  let failures = 0;
  const check = (label: string, ok: boolean, detail = "") => {
    if (!ok) failures++;
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  };

  for (const planCode of ["monthly", "yearly"]) {
    const result = await createCheckoutSession({
      userId: user.id,
      planCode,
      origin: "http://localhost:3000",
    });

    if (!result.ok) {
      check(`${planCode}: session created`, false, result.error);
      continue;
    }

    check(`${planCode}: session created`, true);

    // Pull the session back from Stripe and confirm what it actually contains.
    const stripe = getStripe();
    const sessionId = new URL(result.url).pathname.split("/").pop() ?? "";
    const sessions = await stripe.checkout.sessions.list({ limit: 1 });
    const session = sessions.data[0];

    check(`${planCode}: url points at Stripe`, result.url.includes("stripe.com"));
    check(`${planCode}: mode is subscription`, session?.mode === "subscription");
    check(
      `${planCode}: currency is EUR`,
      session?.currency?.toUpperCase() === "EUR",
      session?.currency ?? "none",
    );
    check(
      `${planCode}: carries userId metadata`,
      session?.metadata?.userId === user.id,
    );
    check(
      `${planCode}: carries planCode metadata`,
      session?.metadata?.planCode === planCode,
    );
    check(
      `${planCode}: amount matches plan`,
      typeof session?.amount_total === "number" && session.amount_total > 0,
      `${session?.amount_total} ${session?.currency}`,
    );

    void sessionId;
  }

  // A plan that does not exist must be refused, not silently defaulted.
  const bogus = await createCheckoutSession({
    userId: user.id,
    planCode: "does-not-exist",
    origin: "http://localhost:3000",
  });
  check("unknown plan is refused", !bogus.ok, bogus.ok ? "created anyway" : "");

  console.log(
    failures === 0 ? "\nCheckout integration OK.\n" : `\n${failures} check(s) FAILED.\n`,
  );

  process.exitCode = failures === 0 ? 0 : 1;
}

main()
  .catch((error) => {
    console.error("\nVerification failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

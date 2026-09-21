import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";

import { asc, eq } from "drizzle-orm";
import { Check } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { CHARITY_MIN_PERCENT, SCORES_RETAINED } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Monthly or yearly. Both enter every draw, both give to charity.",
};

const INCLUDED = [
  `Log and edit your latest ${SCORES_RETAINED} rounds`,
  "Automatic entry into every monthly draw",
  `At least ${CHARITY_MIN_PERCENT}% of every payment to your chosen charity`,
  "Full draw history and winnings tracking",
  "Change your cause or percentage any time",
];

/**
 * Pricing — PRD §04.
 *
 * Plans are read from the database rather than hard-coded, so an admin
 * changing a price changes this page. Checkout itself is wired in Phase 2; the
 * buttons currently route to signup for signed-out visitors.
 */
export default async function PricingPage() {
  // Live figures: render per request, never at build time. Without this the
  // build would query the database, fail when it is unreachable, or bake
  // stale numbers into static HTML when it is.
  await connection();

  const [user, planRows] = await Promise.all([
    getCurrentUser(),
    db
      .select()
      .from(plans)
      .where(eq(plans.isActive, true))
      .orderBy(asc(plans.sortOrder)),
  ]);

  const monthly = planRows.find((p) => p.code === "monthly");
  const yearly = planRows.find((p) => p.code === "yearly");

  // Shown as the yearly plan's headline benefit (PRD §04: "discounted rate").
  const savingMinor =
    monthly && yearly ? monthly.priceMinor * 12 - yearly.priceMinor : 0;

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-16">
        <div className="mx-auto max-w-5xl space-y-12">
          <header className="max-w-2xl space-y-4">
            <h1 className="text-5xl sm:text-6xl">
              One price.
              <br />
              <span className="text-orange">Three things happen.</span>
            </h1>
            <p className="text-lg leading-relaxed text-ink-soft">
              You get in every draw, your cause gets paid, and the prize pool
              grows. Cancel whenever you like — you keep access until the period
              you paid for runs out.
            </p>
          </header>

          <div className="grid gap-6 md:grid-cols-2">
            {planRows.map((plan) => {
              const isYearly = plan.code === "yearly";

              return (
                <article
                  key={plan.id}
                  className={`card-retro card-lift relative flex flex-col p-7 ${
                    isYearly ? "bg-forest text-cream" : "bg-paper"
                  }`}
                >
                  {isYearly && savingMinor > 0 && (
                    <span className="absolute -top-3.5 right-6 rotate-2 rounded-full border-2 border-ink bg-mustard px-3 py-1 text-xs font-bold uppercase tracking-widest text-ink shadow-retro-sm">
                      Save {formatMoney(savingMinor, plan.currency, { hideDecimals: true })}
                    </span>
                  )}

                  <h2 className="text-3xl">{plan.name}</h2>

                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="font-mono text-5xl font-bold tabular">
                      {formatMoney(plan.priceMinor, plan.currency)}
                    </span>
                    <span
                      className={isYearly ? "text-cream/70" : "text-ink-faint"}
                    >
                      /{plan.interval}
                    </span>
                  </p>

                  {plan.description && (
                    <p
                      className={`mt-3 leading-relaxed ${
                        isYearly ? "text-cream/80" : "text-ink-soft"
                      }`}
                    >
                      {plan.description}
                    </p>
                  )}

                  <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                    {INCLUDED.map((item) => (
                      <li key={item} className="flex gap-2.5">
                        <Check
                          className={`mt-0.5 size-4 shrink-0 ${
                            isYearly ? "text-mustard" : "text-teal"
                          }`}
                          aria-hidden
                        />
                        <span className={isYearly ? "text-cream/90" : "text-ink-soft"}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-7">
                    <Button
                      as={Link}
                      href={user ? `/subscribe?plan=${plan.code}` : "/signup"}
                      size="lg"
                      fullWidth
                      variant={isYearly ? "secondary" : "primary"}
                    >
                      {user ? `Choose ${plan.name.toLowerCase()}` : "Get started"}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>

          <section className="card-retro bg-cream-deep p-6">
            <h2 className="text-xl">Where your money goes</h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-soft">
              Every payment is split the moment it is received, and the split is
              recorded permanently. Your charity is paid at the percentage you
              set — a floor of {CHARITY_MIN_PERCENT}%, and as much more as you
              like. A fixed share funds the prize pool. We keep the rest, and
              that is the part that shrinks when you choose to give more.
            </p>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

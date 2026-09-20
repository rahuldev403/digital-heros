import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { asc, eq } from "drizzle-orm";
import { Check, Lock } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { CHARITY_MIN_PERCENT } from "@/lib/constants";
import { requireUser } from "@/lib/dal";
import { applyBps, applyPercent, formatMoney } from "@/lib/money";
import { isStripeReady } from "@/lib/stripe";

import { CheckoutButton } from "./_components/checkout-button";

export const metadata: Metadata = { title: "Subscribe" };

/**
 * Checkout confirmation — PRD §04.
 *
 * Shows exactly how the payment will be split before the user commits. The
 * charity share is the product's whole premise, so telling someone what their
 * money does *before* they pay is more persuasive than telling them after
 * (§12 CTA).
 */
export default async function SubscribePage({ searchParams }: PageProps<"/subscribe">) {
  const user = await requireUser("/subscribe");
  const params = await searchParams;

  const requestedPlan = typeof params.plan === "string" ? params.plan : null;

  const planRows = await db
    .select()
    .from(plans)
    .where(eq(plans.isActive, true))
    .orderBy(asc(plans.sortOrder));

  // An unknown or missing plan code goes back to pricing rather than guessing.
  const selected = requestedPlan
    ? planRows.find((p) => p.code === requestedPlan)
    : undefined;

  if (!selected) redirect("/pricing");

  // Already subscribed — nothing to buy.
  if (user.subscription.hasAccess) {
    return (
      <>
        <SiteHeader />
        <main className="flex-1 px-5 py-16">
          <div className="mx-auto max-w-lg space-y-6 text-center">
            <h1 className="text-4xl">You&apos;re already in.</h1>
            <p className="text-ink-soft">
              Your {user.subscription.planName} subscription is active. There is
              nothing to pay.
            </p>
            <div className="flex justify-center">
              <Button as={Link} href="/dashboard" size="lg">
                Go to your dashboard
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  const charityMinor = applyPercent(selected.priceMinor, user.charityPercent);
  const poolMinor = applyBps(selected.priceMinor, selected.prizePoolShareBps);
  const platformMinor = selected.priceMinor - charityMinor - poolMinor;

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-14">
        <div className="mx-auto max-w-lg space-y-8">
          <header className="space-y-2">
            <h1 className="text-4xl sm:text-5xl">Confirm your plan</h1>
            <p className="text-ink-soft">
              You can cancel any time and keep access until the period you paid
              for ends.
            </p>
          </header>

          <section className="card-retro overflow-hidden">
            <div className="flex items-baseline justify-between border-b-2 border-ink bg-cream-deep px-5 py-4">
              <div>
                <h2 className="text-2xl">{selected.name}</h2>
                <p className="text-sm text-ink-soft">
                  Billed every {selected.interval}
                </p>
              </div>
              <p className="font-mono text-3xl font-bold tabular">
                {formatMoney(selected.priceMinor, selected.currency)}
              </p>
            </div>

            {/* The split, stated before payment. */}
            <div className="space-y-3 p-5">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                Where each payment goes
              </p>

              <SplitRow
                label={user.charityName ?? "Your chosen charity"}
                sub={`${user.charityPercent}% — your setting`}
                amount={formatMoney(charityMinor, selected.currency)}
                tone="text-forest"
              />
              <SplitRow
                label="Prize pool"
                sub={`${selected.prizePoolShareBps / 100}% — funds the monthly draw`}
                amount={formatMoney(poolMinor, selected.currency)}
                tone="text-plum"
              />
              <SplitRow
                label="Platform"
                sub="Running the thing"
                amount={formatMoney(platformMinor, selected.currency)}
                tone="text-ink-soft"
              />

              {!user.charityId && (
                <p className="rounded-xl border-2 border-ink bg-mustard px-3.5 py-2.5 text-sm">
                  You have not chosen a cause yet, so the minimum{" "}
                  {CHARITY_MIN_PERCENT}% will be held until you do.{" "}
                  <Link href="/dashboard/charity" className="font-bold underline">
                    Choose one now
                  </Link>
                  .
                </p>
              )}
            </div>
          </section>

          {isStripeReady() ? (
            <CheckoutButton
              planCode={selected.code}
              label={`Pay ${formatMoney(selected.priceMinor, selected.currency)}`}
            />
          ) : (
            <p className="rounded-xl border-2 border-ink bg-danger px-4 py-3 text-sm font-medium text-cream">
              Payments are not configured on this environment.
            </p>
          )}

          <ul className="space-y-2 text-sm text-ink-soft">
            {[
              "Secure payment handled by Stripe — we never see your card",
              "Cancel any time from your dashboard",
              "Entered into every monthly draw while active",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden />
                {item}
              </li>
            ))}
          </ul>

          <p className="flex items-center justify-center gap-2 text-xs text-ink-faint">
            <Lock className="size-3.5" aria-hidden />
            Test mode — use card 4242 4242 4242 4242 with any future expiry.
          </p>

          <p className="text-center">
            <Link href="/pricing" className="text-sm text-ink-soft underline">
              Choose a different plan
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function SplitRow({
  label,
  sub,
  amount,
  tone,
}: {
  label: string;
  sub: string;
  amount: string;
  tone: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b-2 border-dashed border-ink/15 pb-2.5 last:border-0">
      <div>
        <p className="font-semibold">{label}</p>
        <p className="text-sm text-ink-faint">{sub}</p>
      </div>
      <p className={`font-mono font-bold tabular ${tone}`}>{amount}</p>
    </div>
  );
}

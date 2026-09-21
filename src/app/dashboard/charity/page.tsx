import type { Metadata } from "next";

import { asc, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { charities, plans, subscriptions } from "@/db/schema";
import { getUserGiving } from "@/lib/giving";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

import { CharitySettingsForm } from "./_components/charity-settings-form";

export const metadata: Metadata = { title: "Your charity" };

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EUR";

/**
 * Charity settings — PRD §08.1.
 *
 * Shows what the user has actually given (from the ledger) alongside the
 * controls to change where future giving goes.
 */
export default async function CharitySettingsPage() {
  const user = await requireUser("/dashboard/charity");

  const [charityRows, giving, [currentPlan]] = await Promise.all([
    db
      .select({
        id: charities.id,
        name: charities.name,
        category: charities.category,
        tagline: charities.tagline,
      })
      .from(charities)
      .where(eq(charities.isActive, true))
      .orderBy(asc(charities.sortOrder), asc(charities.name)),

    // Subscription shares plus signed-in donations, with a per-charity
    // breakdown (see lib/giving.ts).
    getUserGiving(user.id),

    db
      .select({ priceMinor: plans.priceMinor, currency: plans.currency })
      .from(subscriptions)
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(eq(subscriptions.userId, user.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1),
  ]);

  return (
    <div className="space-y-9">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Your charity</h1>
        <p className="max-w-2xl text-ink-soft">
          Choose where your contribution goes, and how much of your subscription
          it is.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border-2 border-ink bg-forest p-5 text-cream shadow-retro">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
            You have given
          </p>
          <p className="mt-1.5 font-mono text-3xl font-bold tabular">
            {formatMoney(giving.totalMinor, CURRENCY)}
          </p>
        </div>

        <div className="rounded-2xl border-2 border-ink bg-mustard p-5 shadow-retro">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-75">
            Current setting
          </p>
          <p className="mt-1.5 font-mono text-3xl font-bold tabular">
            {user.charityPercent}%
          </p>
          <p className="mt-0.5 text-sm">{user.charityName ?? "No cause chosen"}</p>
        </div>
      </div>

      {giving.byCharity.length > 0 && (
        <section className="card-retro space-y-3 p-6">
          <h2 className="text-xl">Where it went</h2>
          <ul className="divide-y-2 divide-dashed divide-ink/15">
            {giving.byCharity.map((row) => (
              <li
                key={row.charityName}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="font-medium">{row.charityName}</span>
                <span className="font-mono font-bold tabular text-forest">
                  {formatMoney(row.totalMinor, CURRENCY)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <CharitySettingsForm
        charities={charityRows}
        currentCharityId={user.charityId}
        currentPercent={user.charityPercent}
        planPriceMinor={currentPlan?.priceMinor ?? null}
        currency={currentPlan?.currency ?? CURRENCY}
      />
    </div>
  );
}

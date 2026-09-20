import type { Metadata } from "next";

import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { charities, payments, plans, subscriptions } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

import { CharitySettingsForm } from "./_components/charity-settings-form";

export const metadata: Metadata = { title: "Your charity" };

/**
 * Charity settings — PRD §08.1.
 *
 * Shows what the user has actually given (from the ledger) alongside the
 * controls to change where future giving goes.
 */
export default async function CharitySettingsPage() {
  const user = await requireUser("/dashboard/charity");

  const [charityRows, [givenTotal], givenByCharity, [currentPlan]] = await Promise.all([
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

    db
      .select({
        total: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int`,
        currency: sql<string>`coalesce(min(${payments.currency}), 'EUR')`,
      })
      .from(payments)
      .where(and(eq(payments.userId, user.id), eq(payments.status, "succeeded"))),

    // Historic giving, grouped by the charity that actually received it.
    db
      .select({
        charityName: charities.name,
        total: sql<number>`sum(${payments.charityAmountMinor})::int`,
        currency: sql<string>`min(${payments.currency})`,
      })
      .from(payments)
      .innerJoin(charities, eq(payments.charityId, charities.id))
      .where(and(eq(payments.userId, user.id), eq(payments.status, "succeeded")))
      .groupBy(charities.name)
      .orderBy(desc(sql`sum(${payments.charityAmountMinor})`)),

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
            {formatMoney(givenTotal.total, givenTotal.currency)}
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

      {givenByCharity.length > 0 && (
        <section className="card-retro space-y-3 p-6">
          <h2 className="text-xl">Where it went</h2>
          <ul className="divide-y-2 divide-dashed divide-ink/15">
            {givenByCharity.map((row) => (
              <li
                key={row.charityName}
                className="flex items-center justify-between gap-4 py-2.5"
              >
                <span className="font-medium">{row.charityName}</span>
                <span className="font-mono font-bold tabular text-forest">
                  {formatMoney(row.total, row.currency)}
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
        currency={currentPlan?.currency ?? givenTotal.currency}
      />
    </div>
  );
}

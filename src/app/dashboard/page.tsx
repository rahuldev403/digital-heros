import type { Metadata } from "next";
import Link from "next/link";

import { eq, sql } from "drizzle-orm";
import { ArrowRight, HeartHandshake, ShieldCheck, Ticket, Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberRow } from "@/components/ui/number-ball";
import { db } from "@/db";
import { drawWinners, payments } from "@/db/schema";
import { MIN_SCORES_FOR_ENTRY, SCORES_RETAINED } from "@/lib/constants";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { currentPeriodKey, formatPeriod } from "@/lib/period";
import { listUserEntries } from "@/lib/services/draws";
import { listScores } from "@/lib/services/scores";
import { describeSubscription } from "@/lib/subscription";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * User dashboard — PRD §10.
 *
 * The brief lists five required modules and all five are here:
 *   ✓ subscription status (active / inactive / renewal date)
 *   ✓ score entry and edit interface        → linked, lives on /dashboard/scores
 *   ✓ selected charity and contribution %
 *   ✓ participation summary (draws entered, upcoming)
 *   ✓ winnings overview (total won, payment status)
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  const [scores, entries, [winnings], [given]] = await Promise.all([
    listScores(user.id),
    listUserEntries(user.id, 5),

    // Total won and how much of it has actually been paid.
    db
      .select({
        totalMinor: sql<number>`coalesce(sum(${drawWinners.prizeMinor}), 0)::int`,
        paidMinor: sql<number>`coalesce(sum(case when ${drawWinners.payoutStatus} = 'paid' then ${drawWinners.prizeMinor} else 0 end), 0)::int`,
        wins: sql<number>`count(*)::int`,
        currency: sql<string>`coalesce(min(${drawWinners.currency}), 'EUR')`,
      })
      .from(drawWinners)
      .where(eq(drawWinners.userId, user.id)),

    db
      .select({
        totalMinor: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int`,
        currency: sql<string>`coalesce(min(${payments.currency}), 'EUR')`,
      })
      .from(payments)
      .where(eq(payments.userId, user.id)),
  ]);

  const missingScores = Math.max(0, MIN_SCORES_FOR_ENTRY - scores.length);
  const isEligible = missingScores === 0;
  const sub = user.subscription;

  return (
    <div className="space-y-9">
      <header className="space-y-1.5">
        <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
          {formatPeriod(currentPeriodKey())}
        </p>
        <h1 className="text-4xl sm:text-5xl">
          Hello, {user.fullName.split(" ")[0]}.
        </h1>
      </header>

      {/* --- Status strip: subscription + eligibility --- */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div
          className={`rounded-2xl border-2 border-ink p-5 shadow-retro ${
            sub.hasAccess ? "bg-forest text-cream" : "bg-paper"
          }`}
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
            Subscription
          </p>
          <p className="mt-1.5 text-lg font-semibold">{describeSubscription(sub)}</p>
          <p className="mt-0.5 text-sm opacity-80">
            {sub.planName ? `${sub.planName} plan` : "No plan"}
            {sub.currentPeriodEnd &&
              ` · ${sub.cancelAtPeriodEnd ? "ends" : "renews"} ${new Intl.DateTimeFormat(
                "en-GB",
                { day: "numeric", month: "short", year: "numeric" },
              ).format(sub.currentPeriodEnd)}`}
          </p>

          {!sub.hasAccess && (
            <div className="mt-4">
              <Button as={Link} href="/pricing" size="sm">
                Subscribe
                <ArrowRight className="size-3.5" aria-hidden />
              </Button>
            </div>
          )}
        </div>

        <div
          className={`rounded-2xl border-2 border-ink p-5 shadow-retro ${
            isEligible ? "bg-mustard" : "bg-paper"
          }`}
        >
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-75">
            Next draw
          </p>
          <p className="mt-1.5 text-lg font-semibold">
            {isEligible
              ? "You are entered"
              : `${missingScores} more ${missingScores === 1 ? "round" : "rounds"} needed`}
          </p>
          <p className="mt-0.5 text-sm text-ink-soft">
            {scores.length} of {SCORES_RETAINED} scores logged
          </p>

          {!isEligible && (
            <div className="mt-4">
              <Button as={Link} href="/dashboard/scores" size="sm">
                Log a round
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* --- Current entry --- */}
      <section className="card-retro space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="inline-flex items-center gap-2 text-2xl">
            <Ticket className="size-5 text-plum" aria-hidden />
            Your numbers
          </h2>
          <Button as={Link} href="/dashboard/scores" variant="secondary" size="sm">
            Manage scores
          </Button>
        </div>

        {scores.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-6 text-center text-ink-soft">
            Log your first round and your numbers appear here.
          </p>
        ) : (
          <>
            <NumberRow numbers={scores.map((s) => s.points)} tone="plum" size="lg" />
            <p className="text-sm text-ink-soft">
              These are your latest {scores.length} Stableford scores — and your
              entry in the next draw.
            </p>
          </>
        )}
      </section>

      {/* --- Winnings + giving --- */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile
          icon={Trophy}
          label="Total won"
          value={formatMoney(winnings.totalMinor, winnings.currency)}
          note={`${winnings.wins} winning ${winnings.wins === 1 ? "entry" : "entries"}`}
          tone="bg-plum text-cream"
        />
        <StatTile
          icon={Trophy}
          label="Paid out"
          value={formatMoney(winnings.paidMinor, winnings.currency)}
          note={
            winnings.totalMinor > winnings.paidMinor
              ? `${formatMoney(winnings.totalMinor - winnings.paidMinor, winnings.currency)} pending`
              : "All settled"
          }
          tone="bg-paper"
        />
        <StatTile
          icon={HeartHandshake}
          label="You have given"
          value={formatMoney(given.totalMinor, given.currency)}
          note={user.charityName ? `to ${user.charityName}` : "No cause chosen"}
          tone="bg-forest text-cream"
        />
      </div>

      {/* --- Charity --- */}
      <section className="card-retro flex flex-wrap items-center justify-between gap-4 bg-cream-deep p-6">
        <div>
          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
            Your cause
          </p>
          <p className="mt-1 text-xl font-semibold">
            {user.charityName ?? "Not chosen yet"}
          </p>
          <p className="text-sm text-ink-soft">
            {user.charityPercent}% of every payment
          </p>
        </div>

        <Button as={Link} href="/dashboard/charity" variant="secondary" size="sm">
          Change
        </Button>
      </section>

      {/* --- Participation summary --- */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl">Your draws</h2>
          <Button as={Link} href="/dashboard/draws" variant="ghost" size="sm">
            See all
            <ArrowRight className="size-3.5" aria-hidden />
          </Button>
        </div>

        {entries.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-8 text-center text-ink-soft">
            You have not been in a draw yet. Log five rounds and you are in the
            next one automatically.
          </p>
        ) : (
          <ul className="space-y-3">
            {entries.map((entry) => (
              <li
                key={entry.drawId}
                className="card-retro flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div>
                  <p className="font-semibold">{entry.name}</p>
                  <p className="text-sm text-ink-soft">
                    {entry.status === "published"
                      ? `Matched ${entry.matchCount ?? 0}`
                      : "Result not published yet"}
                  </p>
                </div>

                {entry.status === "published" && entry.prizeMinor ? (
                  <span className="rounded-xl border-2 border-ink bg-mustard px-3 py-1.5 font-mono font-bold tabular shadow-retro-sm">
                    {formatMoney(entry.prizeMinor, entry.currency)}
                  </span>
                ) : (
                  <span className="text-sm font-bold uppercase tracking-widest text-ink-faint">
                    {entry.status === "published" ? "No win" : "Pending"}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {user.role === "admin" && (
        <Link
          href="/admin"
          className="card-retro card-lift flex items-center gap-3 bg-plum px-5 py-4 text-sm font-semibold text-cream"
        >
          <ShieldCheck className="size-5" aria-hidden />
          Open the admin panel
        </Link>
      )}
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  note: string;
  tone: string;
}) {
  return (
    <div className={`rounded-2xl border-2 border-ink p-5 shadow-retro ${tone}`}>
      <p className="inline-flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular">{value}</p>
      <p className="mt-0.5 text-sm opacity-75">{note}</p>
    </div>
  );
}

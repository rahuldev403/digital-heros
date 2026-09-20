import type { Metadata } from "next";
import Link from "next/link";

import { desc, eq, sql } from "drizzle-orm";
import {
  ArrowRight,
  HeartHandshake,
  Ticket,
  TrendingUp,
  Users as UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { charities, drawWinners, payments, subscriptions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { currentPeriodKey, formatPeriod } from "@/lib/period";
import { calculatePool, listAllDraws } from "@/lib/services/draws";

export const metadata: Metadata = { title: "Admin" };

/**
 * Admin overview — PRD §11.05 "Reports & analytics".
 *
 * The four figures the brief names: total users, total prize pool, charity
 * contribution totals, draw statistics.
 */
export default async function AdminOverviewPage() {
  await requireAdmin();

  const period = currentPeriodKey();

  const [
    [userStats],
    [ledger],
    pool,
    drawRows,
    [pendingClaims],
    topCharities,
  ] = await Promise.all([
    db
      .select({
        total: sql<number>`count(*)::int`,
        admins: sql<number>`count(*) filter (where ${users.role} = 'admin')::int`,
        suspended: sql<number>`count(*) filter (where ${users.status} = 'suspended')::int`,
        activeSubs: sql<number>`(select count(*) from ${subscriptions} where ${subscriptions.status} = 'active')::int`,
      })
      .from(users),

    db
      .select({
        charityTotal: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int`,
        poolTotal: sql<number>`coalesce(sum(${payments.prizePoolAmountMinor}), 0)::int`,
        platformTotal: sql<number>`coalesce(sum(${payments.platformAmountMinor}), 0)::int`,
        gross: sql<number>`coalesce(sum(${payments.amountMinor}), 0)::int`,
        currency: sql<string>`coalesce(min(${payments.currency}), 'EUR')`,
      })
      .from(payments)
      .where(eq(payments.status, "succeeded")),

    calculatePool(period),
    listAllDraws(5),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(drawWinners)
      .where(eq(drawWinners.payoutStatus, "pending")),

    db
      .select({
        name: charities.name,
        slug: charities.slug,
        total: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int`,
      })
      .from(charities)
      .leftJoin(payments, eq(payments.charityId, charities.id))
      .groupBy(charities.id, charities.name, charities.slug)
      .orderBy(desc(sql`coalesce(sum(${payments.charityAmountMinor}), 0)`))
      .limit(5),
  ]);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Overview</h1>
        <p className="text-ink-soft">
          Platform totals, read live from the payments ledger.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={UsersIcon}
          label="Total users"
          value={String(userStats.total)}
          note={`${userStats.activeSubs} active subscriptions`}
          tone="bg-teal text-cream"
        />
        <Tile
          icon={Ticket}
          label={`${formatPeriod(period)} pool`}
          value={formatMoney(pool.totalMinor, ledger.currency)}
          note={
            pool.rolloverInMinor > 0
              ? `includes ${formatMoney(pool.rolloverInMinor, ledger.currency)} rollover`
              : "no rollover carried in"
          }
          tone="bg-plum text-cream"
        />
        <Tile
          icon={HeartHandshake}
          label="Charity total"
          value={formatMoney(ledger.charityTotal, ledger.currency)}
          note="all time"
          tone="bg-forest text-cream"
        />
        <Tile
          icon={TrendingUp}
          label="Gross collected"
          value={formatMoney(ledger.gross, ledger.currency)}
          note={`${formatMoney(ledger.platformTotal, ledger.currency)} platform`}
          tone="bg-mustard"
        />
      </div>

      {pendingClaims.total > 0 && (
        <Link
          href="/admin/winners"
          className="card-retro card-lift flex items-center justify-between gap-4 bg-orange px-5 py-4 text-cream"
        >
          <span className="font-semibold">
            {pendingClaims.total} winner{pendingClaims.total === 1 ? "" : "s"}{" "}
            awaiting verification or payout
          </span>
          <ArrowRight className="size-5 shrink-0" aria-hidden />
        </Link>
      )}

      {/* --- Ledger split, proving the invariant holds --- */}
      <section className="card-retro space-y-4 p-6">
        <h2 className="text-2xl">Where the money went</h2>
        <div className="space-y-2">
          <SplitBar
            label="Charity"
            amountMinor={ledger.charityTotal}
            totalMinor={ledger.gross}
            currency={ledger.currency}
            className="bg-forest"
          />
          <SplitBar
            label="Prize pool"
            amountMinor={ledger.poolTotal}
            totalMinor={ledger.gross}
            currency={ledger.currency}
            className="bg-plum"
          />
          <SplitBar
            label="Platform"
            amountMinor={ledger.platformTotal}
            totalMinor={ledger.gross}
            currency={ledger.currency}
            className="bg-mustard"
          />
        </div>
        <p className="font-mono text-xs text-ink-faint">
          {formatMoney(ledger.charityTotal, ledger.currency)} +{" "}
          {formatMoney(ledger.poolTotal, ledger.currency)} +{" "}
          {formatMoney(ledger.platformTotal, ledger.currency)} ={" "}
          {formatMoney(
            ledger.charityTotal + ledger.poolTotal + ledger.platformTotal,
            ledger.currency,
          )}{" "}
          (gross {formatMoney(ledger.gross, ledger.currency)})
        </p>
      </section>

      {/* --- Draw statistics --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Recent draws</h2>
          <Button as={Link} href="/admin/draws" size="sm" variant="secondary">
            Manage draws
          </Button>
        </div>

        {drawRows.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-8 text-center text-ink-soft">
            No draws yet. Create the first one from Manage draws.
          </p>
        ) : (
          <ul className="space-y-2">
            {drawRows.map((draw) => (
              <li
                key={draw.id}
                className="card-retro flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div>
                  <p className="font-semibold">{draw.name}</p>
                  <p className="text-sm text-ink-soft">
                    {draw.entryCount} entries ·{" "}
                    {formatMoney(draw.totalPoolMinor, draw.currency)} pool
                  </p>
                </div>
                <StatusPill status={draw.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* --- Charity leaderboard --- */}
      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-2xl">Top causes</h2>
          <Button as={Link} href="/admin/charities" size="sm" variant="secondary">
            Manage charities
          </Button>
        </div>

        <ul className="card-retro divide-y-2 divide-dashed divide-ink/15 p-5">
          {topCharities.map((charity) => (
            <li
              key={charity.slug}
              className="flex items-center justify-between gap-4 py-2.5"
            >
              <span className="font-medium">{charity.name}</span>
              <span className="font-mono font-bold tabular text-forest">
                {formatMoney(charity.total, ledger.currency)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Tile({
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
      <p className="mt-0.5 text-xs opacity-75">{note}</p>
    </div>
  );
}

function SplitBar({
  label,
  amountMinor,
  totalMinor,
  currency,
  className,
}: {
  label: string;
  amountMinor: number;
  totalMinor: number;
  currency: string;
  className: string;
}) {
  const percent = totalMinor > 0 ? (amountMinor / totalMinor) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-semibold">{label}</span>
        <span className="font-mono tabular">
          {formatMoney(amountMinor, currency)} · {percent.toFixed(1)}%
        </span>
      </div>
      <div className="h-4 overflow-hidden rounded-full border-2 border-ink bg-cream-deep">
        <div
          className={`h-full ${className}`}
          style={{ width: `${Math.max(percent, 0)}%` }}
        />
      </div>
    </div>
  );
}

import type { Metadata } from "next";

import { desc, eq, ilike, or, sql } from "drizzle-orm";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { charities, plans, scores, subscriptions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "User management" };

/**
 * User management — PRD §11.01: view and edit user profiles, edit golf scores,
 * manage subscriptions.
 *
 * Read-only listing with search. Each row links through to the per-user detail
 * view where edits happen.
 */
export default async function AdminUsersPage({
  searchParams,
}: PageProps<"/admin/users">) {
  await requireAdmin();

  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const rows = await db
    .select({
      id: users.id,
      fullName: users.fullName,
      email: users.email,
      role: users.role,
      status: users.status,
      charityName: charities.name,
      charityPercent: users.charityPercent,
      createdAt: users.createdAt,
      subscriptionStatus: subscriptions.status,
      planName: plans.name,
      planPriceMinor: plans.priceMinor,
      currency: plans.currency,
      scoreCount: sql<number>`(select count(*) from ${scores} where ${scores.userId} = ${users.id})::int`,
    })
    .from(users)
    .leftJoin(charities, eq(users.charityId, charities.id))
    // Only the most recent subscription per user, so a resubscriber does not
    // appear twice in the list.
    .leftJoin(
      subscriptions,
      sql`${subscriptions.id} = (
        select s.id from ${subscriptions} s
        where s.user_id = ${users.id}
        order by s.created_at desc
        limit 1
      )`,
    )
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      query
        ? or(ilike(users.fullName, `%${query}%`), ilike(users.email, `%${query}%`))
        : undefined,
    )
    .orderBy(desc(users.createdAt))
    .limit(100);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Users</h1>
        <p className="text-ink-soft">{rows.length} shown</p>
      </header>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-64 flex-1">
          <label htmlFor="q" className="sr-only">
            Search users
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-faint"
              aria-hidden
            />
            <input
              id="q"
              name="q"
              defaultValue={query}
              placeholder="Search by name or email…"
              className="h-12 w-full rounded-xl border-2 border-ink bg-paper pl-10 pr-3.5 focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
            />
          </div>
        </div>
        <Button type="submit" size="lg">
          Search
        </Button>
      </form>

      <div className="card-retro overflow-x-auto">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b-2 border-ink bg-cream-deep text-left">
            <tr>
              <Th>Member</Th>
              <Th>Subscription</Th>
              <Th>Charity</Th>
              <Th className="text-right">Scores</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-dashed divide-ink/15">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <Td>
                  <p className="font-semibold">{row.fullName}</p>
                  <p className="text-ink-soft">{row.email}</p>
                  {row.role === "admin" && (
                    <StatusPill status="admin" className="mt-1.5 bg-plum text-cream" />
                  )}
                </Td>
                <Td>
                  {row.subscriptionStatus ? (
                    <>
                      <StatusPill status={row.subscriptionStatus} />
                      <p className="mt-1.5 text-ink-soft">
                        {row.planName}
                        {row.planPriceMinor !== null &&
                          ` · ${formatMoney(row.planPriceMinor, row.currency ?? "EUR")}`}
                      </p>
                    </>
                  ) : (
                    <StatusPill status="none" />
                  )}
                </Td>
                <Td>
                  <p>{row.charityName ?? "—"}</p>
                  <p className="text-ink-soft">{row.charityPercent}%</p>
                </Td>
                <Td className="text-right">
                  <span
                    className={`font-mono font-bold tabular ${
                      row.scoreCount >= 5 ? "text-forest" : "text-ink-faint"
                    }`}
                  >
                    {row.scoreCount}/5
                  </span>
                </Td>
                <Td>
                  <StatusPill status={row.status} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-10 text-center text-ink-soft">
          No users match that search.
        </p>
      )}
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest ${className}`}
    >
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

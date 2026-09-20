import type { Metadata } from "next";
import Link from "next/link";

import { asc, sql } from "drizzle-orm";
import { ExternalLink, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { charities, charityEvents, payments, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

export const metadata: Metadata = { title: "Charity management" };

/**
 * Charity management — PRD §11.03.
 *
 * Lists every charity with what it has raised and how many members support it,
 * so an admin can see the effect of a listing before editing it.
 */
export default async function AdminCharitiesPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: charities.id,
      name: charities.name,
      slug: charities.slug,
      category: charities.category,
      isActive: charities.isActive,
      isFeatured: charities.isFeatured,
      raisedMinor: sql<number>`(
        select coalesce(sum(p.charity_amount_minor), 0)::int
        from ${payments} p
        where p.charity_id = ${charities.id} and p.status = 'succeeded'
      )`,
      supporters: sql<number>`(
        select count(*)::int from ${users} u where u.charity_id = ${charities.id}
      )`,
      eventCount: sql<number>`(
        select count(*)::int from ${charityEvents} e where e.charity_id = ${charities.id}
      )`,
    })
    .from(charities)
    .orderBy(asc(charities.sortOrder), asc(charities.name));

  const totalRaised = rows.reduce((sum, row) => sum + row.raisedMinor, 0);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl">Charities</h1>
          <p className="text-ink-soft">
            {rows.length} listed · {formatMoney(totalRaised, "EUR")} raised in total
          </p>
        </div>
        <Button as={Link} href="/admin/charities/new" size="lg">
          <Plus className="size-4" aria-hidden />
          New charity
        </Button>
      </header>

      <div className="card-retro overflow-x-auto">
        <table className="w-full min-w-3xl text-sm">
          <thead className="border-b-2 border-ink bg-cream-deep text-left">
            <tr>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest">
                Charity
              </th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest">
                Category
              </th>
              <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">
                Raised
              </th>
              <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">
                Supporters
              </th>
              <th className="px-4 py-3 text-right text-[0.65rem] font-bold uppercase tracking-widest">
                Events
              </th>
              <th className="px-4 py-3 text-[0.65rem] font-bold uppercase tracking-widest">
                State
              </th>
            </tr>
          </thead>
          <tbody className="divide-y-2 divide-dashed divide-ink/15">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/charities/${row.id}`}
                    className="font-semibold hover:text-teal"
                  >
                    {row.name}
                  </Link>
                  <Link
                    href={`/charities/${row.slug}`}
                    className="ml-2 inline-flex items-center text-ink-faint hover:text-teal"
                    aria-label={`View public profile for ${row.name}`}
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                  </Link>
                </td>
                <td className="px-4 py-3 text-ink-soft">{row.category}</td>
                <td className="px-4 py-3 text-right font-mono font-bold tabular text-forest">
                  {formatMoney(row.raisedMinor, "EUR")}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular">
                  {row.supporters}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular">
                  {row.eventCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <StatusPill status={row.isActive ? "active" : "expired"} />
                    {row.isFeatured && (
                      <StatusPill
                        status="spotlight"
                        className="bg-mustard text-ink"
                      />
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );
}

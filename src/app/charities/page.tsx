import type { Metadata } from "next";
import Link from "next/link";

import { and, asc, eq, ilike, or } from "drizzle-orm";
import { ArrowRight, Search } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { charities } from "@/db/schema";
import { charityRaisedSql } from "@/lib/giving";
import { formatMoney } from "@/lib/money";

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EUR";

export const metadata: Metadata = {
  title: "Charities",
  description:
    "Every subscriber picks a cause. Browse the charities supported by Digital Heroes members.",
};

/**
 * Charity directory — PRD §08.2 DISCOVERY: "Charity listing page with search
 * and filter."
 *
 * Search and category filter are URL state, not component state: a filtered
 * view is shareable, survives a refresh, works with the back button, and needs
 * no client JavaScript. The form submits with GET for exactly that reason.
 */
export default async function CharitiesPage({
  searchParams,
}: PageProps<"/charities">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";
  const category = typeof params.category === "string" ? params.category : "";

  const conditions = [eq(charities.isActive, true)];

  if (query) {
    // ilike is case-insensitive; the `%` wrapping makes it a contains search.
    conditions.push(
      or(
        ilike(charities.name, `%${query}%`),
        ilike(charities.summary, `%${query}%`),
        ilike(charities.tagline, `%${query}%`),
      )!,
    );
  }

  if (category) conditions.push(eq(charities.category, category));

  const [rows, categoryRows] = await Promise.all([
    db
      .select({ charity: charities, raisedMinor: charityRaisedSql(charities.id) })
      .from(charities)
      .where(and(...conditions))
      .orderBy(asc(charities.sortOrder), asc(charities.name)),

    db
      .selectDistinct({ category: charities.category })
      .from(charities)
      .where(eq(charities.isActive, true))
      .orderBy(asc(charities.category)),
  ]);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-14">
        <div className="mx-auto max-w-6xl space-y-10">
          <header className="max-w-2xl space-y-4">
            <h1 className="text-5xl sm:text-6xl">
              Pick a
              <span className="text-forest"> cause.</span>
            </h1>
            <p className="text-lg leading-relaxed text-ink-soft">
              Every subscriber directs part of their fee to one of these. Change
              yours whenever you like — what you have already given stays with
              the charity that received it.
            </p>
          </header>

          {/* Search + filter. GET so the result is a shareable URL. */}
          <form method="get" className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-1.5">
              <label
                htmlFor="q"
                className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
              >
                Search
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
                  placeholder="Name or keyword…"
                  className="h-12 w-full rounded-xl border-2 border-ink bg-paper pl-10 pr-3.5 text-ink placeholder:text-ink-faint focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
                />
              </div>
            </div>

            <div className="min-w-44 space-y-1.5">
              <label
                htmlFor="category"
                className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
              >
                Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={category}
                className="h-12 w-full appearance-none rounded-xl border-2 border-ink bg-paper px-3.5 text-ink focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
              >
                <option value="">All categories</option>
                {categoryRows.map((row) => (
                  <option key={row.category} value={row.category}>
                    {row.category}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" size="lg">
              Filter
            </Button>

            {(query || category) && (
              <Button as={Link} href="/charities" size="lg" variant="ghost">
                Clear
              </Button>
            )}
          </form>

          <p className="text-sm font-bold uppercase tracking-widest text-ink-faint">
            {rows.length} {rows.length === 1 ? "cause" : "causes"}
            {category && ` in ${category}`}
            {query && ` matching “${query}”`}
          </p>

          {rows.length === 0 ? (
            <div className="card-retro bg-cream-deep p-10 text-center">
              <p className="text-lg font-semibold">No causes match that search.</p>
              <p className="mt-1 text-ink-soft">
                Try a different keyword, or clear the filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rows.map(({ charity, raisedMinor }) => {

                return (
                  <article
                    key={charity.id}
                    className="card-retro card-lift flex flex-col overflow-hidden"
                  >
                    <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-cream-deep px-5 py-2.5">
                      <span className="text-xs font-bold uppercase tracking-widest">
                        {charity.category}
                      </span>
                      {charity.isFeatured && (
                        <span className="rounded-full border-2 border-ink bg-mustard px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-widest">
                          Spotlight
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col gap-3 p-5">
                      <h2 className="text-xl">{charity.name}</h2>

                      {charity.tagline && (
                        <p className="text-sm font-semibold text-teal">
                          {charity.tagline}
                        </p>
                      )}

                      <p className="flex-1 text-sm leading-relaxed text-ink-soft">
                        {charity.summary}
                      </p>

                      <div className="flex items-center justify-between gap-3 border-t-2 border-dashed border-ink/20 pt-3">
                        <div>
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                            Raised
                          </p>
                          <p className="font-mono font-bold tabular text-forest">
                            {formatMoney(raisedMinor, CURRENCY)}
                          </p>
                        </div>

                        <Button
                          as={Link}
                          href={`/charities/${charity.slug}`}
                          size="sm"
                          variant="secondary"
                        >
                          View
                          <ArrowRight className="size-3.5" aria-hidden />
                        </Button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { and, asc, eq, gte, sql } from "drizzle-orm";
import { ArrowLeft, CalendarDays, Globe, MapPin, Users } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { charities, charityEvents, users } from "@/db/schema";
import { getCharityGiving } from "@/lib/giving";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

/**
 * Charity profile — PRD §08.2 DETAIL: "Description, images, and upcoming
 * events such as golf days."
 */

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "EUR";

async function loadCharity(slug: string) {
  const [charity] = await db
    .select()
    .from(charities)
    .where(eq(charities.slug, slug))
    .limit(1);

  return charity;
}

export async function generateMetadata({
  params,
}: PageProps<"/charities/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const charity = await loadCharity(slug);

  if (!charity) return { title: "Charity not found" };

  return {
    title: charity.name,
    description: charity.summary,
  };
}

export default async function CharityProfilePage({
  params,
}: PageProps<"/charities/[slug]">) {
  const { slug } = await params;
  const charity = await loadCharity(slug);

  if (!charity) notFound();

  const [user, events, giving, [supporters]] = await Promise.all([
    getCurrentUser(),

    // Only what is still ahead; a past golf day is not a reason to give.
    db
      .select()
      .from(charityEvents)
      .where(
        and(
          eq(charityEvents.charityId, charity.id),
          gte(charityEvents.startsAt, new Date()),
        ),
      )
      .orderBy(asc(charityEvents.startsAt)),

    // Subscription shares plus one-off donations (see lib/giving.ts).
    getCharityGiving(charity.id),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.charityId, charity.id)),
  ]);

  const isMyCharity = user?.charityId === charity.id;

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-12">
        <div className="mx-auto max-w-4xl space-y-10">
          <Link
            href="/charities"
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All charities
          </Link>

          <header className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border-2 border-ink bg-cream-deep px-3 py-1 text-xs font-bold uppercase tracking-widest">
                {charity.category}
              </span>
              {charity.isFeatured && (
                <span className="rounded-full border-2 border-ink bg-mustard px-3 py-1 text-xs font-bold uppercase tracking-widest">
                  Spotlight
                </span>
              )}
              {isMyCharity && (
                <span className="rounded-full border-2 border-ink bg-forest px-3 py-1 text-xs font-bold uppercase tracking-widest text-cream">
                  Your cause
                </span>
              )}
            </div>

            <h1 className="text-5xl sm:text-6xl">{charity.name}</h1>

            {charity.tagline && (
              <p className="text-xl font-semibold text-teal">{charity.tagline}</p>
            )}

            <div className="flex flex-wrap gap-4 text-sm text-ink-soft">
              {charity.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden />
                  {charity.location}
                </span>
              )}
              {charity.websiteUrl && (
                <a
                  href={charity.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-ink"
                >
                  <Globe className="size-4" aria-hidden />
                  Website
                </a>
              )}
            </div>
          </header>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-ink bg-forest p-5 text-cream shadow-retro">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
                Raised through Digital Heroes
              </p>
              <p className="mt-1.5 font-mono text-3xl font-bold tabular">
                {formatMoney(giving.totalMinor, CURRENCY)}
              </p>
            </div>

            <div className="rounded-2xl border-2 border-ink bg-mustard p-5 shadow-retro">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-75">
                Members supporting
              </p>
              <p className="mt-1.5 inline-flex items-center gap-2 font-mono text-3xl font-bold tabular">
                <Users className="size-6" aria-hidden />
                {supporters.total}
              </p>
            </div>
          </div>

          <section className="card-retro space-y-3 p-7">
            <h2 className="text-2xl">About</h2>
            <p className="leading-relaxed text-ink-soft">{charity.description}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl">Upcoming events</h2>

            {events.length === 0 ? (
              <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-5 text-ink-soft">
                Nothing scheduled right now. Check back — golf days are usually
                announced a few weeks ahead.
              </p>
            ) : (
              <ul className="space-y-3">
                {events.map((event) => (
                  <li key={event.id} className="card-retro card-lift p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1.5">
                        <h3 className="text-lg">{event.title}</h3>
                        {event.description && (
                          <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
                            {event.description}
                          </p>
                        )}
                        {event.location && (
                          <p className="inline-flex items-center gap-1.5 text-sm text-ink-faint">
                            <MapPin className="size-3.5" aria-hidden />
                            {event.location}
                          </p>
                        )}
                      </div>

                      <span className="inline-flex shrink-0 items-center gap-2 rounded-xl border-2 border-ink bg-cream-deep px-3 py-2 text-sm font-bold">
                        <CalendarDays className="size-4" aria-hidden />
                        <time dateTime={event.startsAt.toISOString()}>
                          {new Intl.DateTimeFormat("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(event.startsAt)}
                        </time>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card-retro flex flex-wrap items-center justify-between gap-4 bg-cream-deep p-7">
            <div>
              <h2 className="text-2xl">
                {isMyCharity ? "You support this cause" : "Support this cause"}
              </h2>
              <p className="mt-1 text-ink-soft">
                {isMyCharity
                  ? "Part of every payment you make goes here."
                  : "Choose it as your cause and part of every payment goes here."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* A one-off gift needs no account and no subscription (§08.1). */}
              {charity.isActive && (
                <Button
                  as={Link}
                  href={`/charities/${charity.slug}/donate`}
                  size="lg"
                  variant="dark"
                >
                  Donate once
                </Button>
              )}
              {!isMyCharity && (
                <Button
                  as={Link}
                  href={user ? "/dashboard/charity" : "/signup"}
                  size="lg"
                >
                  {user ? "Switch to this cause" : "Join and choose"}
                </Button>
              )}
            </div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

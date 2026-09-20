import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { asc, eq, sql } from "drizzle-orm";
import { ArrowLeft, ExternalLink, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { db } from "@/db";
import { charities, charityEvents, payments, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

import { deleteEventAction } from "../actions";
import { CharityForm } from "../_components/charity-form";
import {
  DeleteCharityButton,
  EventForm,
  SpotlightButton,
} from "./_components/charity-admin-panels";

export const metadata: Metadata = { title: "Edit charity" };

export default async function EditCharityPage({
  params,
}: PageProps<"/admin/charities/[id]">) {
  await requireAdmin();

  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [charity] = await db
    .select()
    .from(charities)
    .where(eq(charities.id, id))
    .limit(1);

  if (!charity) notFound();

  const [events, [raised], [supporters]] = await Promise.all([
    db
      .select()
      .from(charityEvents)
      .where(eq(charityEvents.charityId, id))
      .orderBy(asc(charityEvents.startsAt)),

    db
      .select({
        total: sql<number>`coalesce(sum(${payments.charityAmountMinor}), 0)::int`,
        count: sql<number>`count(*)::int`,
        currency: sql<string>`coalesce(min(${payments.currency}), 'EUR')`,
      })
      .from(payments)
      .where(eq(payments.charityId, id)),

    db
      .select({ total: sql<number>`count(*)::int` })
      .from(users)
      .where(eq(users.charityId, id)),
  ]);

  // Drives whether delete is a real delete or a deactivation.
  const hasHistory = raised.count > 0 || supporters.total > 0;

  return (
    <div className="space-y-8">
      <Link
        href="/admin/charities"
        className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All charities
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-4xl sm:text-5xl">{charity.name}</h1>
          <Link
            href={`/charities/${charity.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline"
          >
            View public profile
            <ExternalLink className="size-3.5" aria-hidden />
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border-2 border-ink bg-forest px-4 py-3 text-cream">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest opacity-80">
              Raised
            </p>
            <p className="font-mono font-bold tabular">
              {formatMoney(raised.total, raised.currency)}
            </p>
          </div>
          <div className="rounded-xl border-2 border-ink bg-mustard px-4 py-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-widest opacity-75">
              Supporters
            </p>
            <p className="font-mono font-bold tabular">{supporters.total}</p>
          </div>
        </div>
      </header>

      <SpotlightButton charityId={charity.id} isFeatured={charity.isFeatured} />

      <CharityForm
        charity={{
          id: charity.id,
          name: charity.name,
          slug: charity.slug,
          tagline: charity.tagline,
          summary: charity.summary,
          description: charity.description,
          category: charity.category,
          location: charity.location,
          websiteUrl: charity.websiteUrl,
          logoUrl: charity.logoUrl,
          coverImageUrl: charity.coverImageUrl,
          isFeatured: charity.isFeatured,
          isActive: charity.isActive,
          sortOrder: charity.sortOrder,
        }}
      />

      {/* --- Events --- */}
      <section className="card-retro space-y-5 p-6">
        <h2 className="text-xl">Upcoming events</h2>

        {events.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-5 text-sm text-ink-soft">
            No events yet.
          </p>
        ) : (
          <ul className="divide-y-2 divide-dashed divide-ink/15">
            {events.map((event) => (
              <li
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div>
                  <p className="font-semibold">{event.title}</p>
                  <p className="text-sm text-ink-soft">
                    {new Intl.DateTimeFormat("en-GB", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(event.startsAt)}
                    {event.location && ` · ${event.location}`}
                  </p>
                </div>

                <form action={deleteEventAction}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${event.title}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t-2 border-dashed border-ink/15 pt-5">
          <EventForm charityId={charity.id} />
        </div>
      </section>

      {/* --- Danger zone --- */}
      <section className="card-retro space-y-4 border-danger p-6">
        <h2 className="text-xl text-danger">Remove this charity</h2>
        <DeleteCharityButton
          charityId={charity.id}
          name={charity.name}
          hasHistory={hasHistory}
        />
      </section>
    </div>
  );
}

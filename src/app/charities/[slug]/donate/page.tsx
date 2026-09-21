import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { and, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { db } from "@/db";
import { charities } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

import { DonateForm } from "./_components/donate-form";

export const metadata: Metadata = { title: "Donate" };

/** One-off donation page — PRD §08.1. Open to visitors without an account. */
export default async function DonatePage({ params }: PageProps<"/charities/[slug]/donate">) {
  const { slug } = await params;

  const [charity] = await db
    .select({ name: charities.name, slug: charities.slug, tagline: charities.tagline })
    .from(charities)
    .where(and(eq(charities.slug, slug), eq(charities.isActive, true)))
    .limit(1);

  if (!charity) notFound();

  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-12">
        <div className="mx-auto max-w-lg space-y-8">
          <Link
            href={`/charities/${charity.slug}`}
            className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {charity.name}
          </Link>

          <header className="space-y-2">
            <h1 className="text-4xl sm:text-5xl">
              Give to
              <span className="block text-forest">{charity.name}</span>
            </h1>
            {charity.tagline && <p className="text-lg text-ink-soft">{charity.tagline}</p>}
          </header>

          <DonateForm
            charitySlug={charity.slug}
            charityName={charity.name}
            signedIn={Boolean(user)}
          />
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

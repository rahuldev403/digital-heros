import type { Metadata } from "next";
import Link from "next/link";

import { HeartHandshake } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { settleDonationById } from "@/lib/services/donations";

export const metadata: Metadata = { title: "Thank you" };

/**
 * Donation return page.
 *
 * Settles the donation from the session before rendering, so the thank-you is
 * truthful. The webhook does the same thing independently; whichever runs
 * first wins and the other is a no-op.
 */
export default async function DonationThanksPage({
  params,
  searchParams,
}: PageProps<"/charities/[slug]/donate/thanks">) {
  const { slug } = await params;
  const query = await searchParams;
  const sessionId = typeof query.session_id === "string" ? query.session_id : null;

  let amount: string | null = null;
  let paid = false;

  if (sessionId) {
    try {
      const { session } = await settleDonationById(sessionId);
      paid = session.payment_status === "paid";
      if (session.amount_total) {
        amount = formatMoney(session.amount_total, (session.currency ?? "eur").toUpperCase());
      }
    } catch {
      // Unknown or tampered session id: show the neutral message below.
    }
  }

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-16">
        <div className="mx-auto max-w-lg space-y-6 text-center">
          <span className="inline-flex size-16 items-center justify-center rounded-full border-2 border-ink bg-mustard shadow-retro">
            <HeartHandshake className="size-7" aria-hidden />
          </span>

          <h1 className="text-4xl sm:text-5xl">
            {paid ? "Thank you." : "Nearly there."}
          </h1>

          <p className="text-lg text-ink-soft">
            {paid
              ? `Your ${amount ?? ""} gift has been received. Every cent of it goes to the charity.`
              : "We could not confirm this payment yet. If you were charged, it will appear shortly."}
          </p>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button as={Link} href={`/charities/${slug}`} size="lg">
              Back to the charity
            </Button>
            <Button as={Link} href="/charities" size="lg" variant="secondary">
              Other causes
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

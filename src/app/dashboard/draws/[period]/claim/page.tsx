import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { NumberRow } from "@/components/ui/number-ball";
import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { drawEntries, drawWinners, draws, winnerVerifications } from "@/db/schema";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

import { ClaimForm } from "./_components/claim-form";

export const metadata: Metadata = { title: "Claim your prize" };

/**
 * Winner verification — PRD §09.
 *
 * "Verification process applies to winners only", so this page 404s for anyone
 * who did not win the draw in question — including a signed-in user guessing
 * at period keys.
 */
export default async function ClaimPage({
  params,
}: PageProps<"/dashboard/draws/[period]/claim">) {
  const user = await requireUser("/dashboard/draws");
  const { period } = await params;

  const [winner] = await db
    .select({
      id: drawWinners.id,
      tier: drawWinners.tier,
      matchedNumbers: drawWinners.matchedNumbers,
      prizeMinor: drawWinners.prizeMinor,
      currency: drawWinners.currency,
      verificationStatus: drawWinners.verificationStatus,
      payoutStatus: drawWinners.payoutStatus,
      drawName: draws.name,
      winningNumbers: draws.winningNumbers,
      entryNumbers: drawEntries.numbers,
    })
    .from(drawWinners)
    .innerJoin(draws, eq(drawWinners.drawId, draws.id))
    .innerJoin(drawEntries, eq(drawWinners.entryId, drawEntries.id))
    .where(
      and(
        eq(drawWinners.userId, user.id),
        eq(draws.periodKey, period),
        eq(draws.status, "published"),
      ),
    )
    .limit(1);

  // Not a winner of this draw — indistinguishable from the draw not existing.
  if (!winner) notFound();

  // Previous submissions, so a rejected claimant can see why.
  const history = await db
    .select({
      id: winnerVerifications.id,
      status: winnerVerifications.status,
      note: winnerVerifications.note,
      reviewNote: winnerVerifications.reviewNote,
      uploadId: winnerVerifications.uploadId,
      createdAt: winnerVerifications.createdAt,
      reviewedAt: winnerVerifications.reviewedAt,
    })
    .from(winnerVerifications)
    .where(eq(winnerVerifications.drawWinnerId, winner.id))
    .orderBy(desc(winnerVerifications.createdAt));

  const isSettled =
    winner.verificationStatus === "approved" || winner.payoutStatus === "paid";

  return (
    <div className="space-y-8">
      <Link
        href="/dashboard/draws"
        className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Your draws
      </Link>

      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Claim your prize</h1>
        <p className="text-ink-soft">
          {winner.drawName} — you matched {winner.tier}.
        </p>
      </header>

      <section className="card-retro space-y-4 bg-mustard p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-75">
              Your prize
            </p>
            <p className="font-mono text-4xl font-bold tabular">
              {formatMoney(winner.prizeMinor, winner.currency)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatusPill status={winner.verificationStatus} />
            <StatusPill status={winner.payoutStatus} />
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-75">
            Your numbers
          </p>
          <NumberRow
            numbers={winner.entryNumbers}
            matchedNumbers={winner.winningNumbers ?? []}
            tone="plum"
          />
        </div>
      </section>

      {isSettled ? (
        <div className="card-retro space-y-2 bg-forest p-6 text-cream">
          <h2 className="text-2xl">
            {winner.payoutStatus === "paid" ? "Paid" : "Approved"}
          </h2>
          <p className="text-cream/85">
            {winner.payoutStatus === "paid"
              ? "This prize has been paid out. Nothing further is needed."
              : "Your claim was approved. The payout is being processed."}
          </p>
        </div>
      ) : (
        <>
          <section className="card-retro space-y-2 bg-cream-deep p-5">
            <h2 className="text-lg">What we need</h2>
            <p className="text-sm leading-relaxed text-ink-soft">
              A screenshot from your golf platform showing the five rounds above.
              It is how we confirm the scores behind a winning entry were really
              played before the draw.
            </p>
          </section>

          <ClaimForm periodKey={period} />
        </>
      )}

      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-xl">Submission history</h2>
          <ul className="space-y-2">
            {history.map((item) => (
              <li
                key={item.id}
                className="card-retro flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <StatusPill status={item.status} />
                    <span className="text-sm text-ink-soft">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      }).format(item.createdAt)}
                    </span>
                  </div>
                  {item.reviewNote && (
                    <p className="text-sm text-ink-soft">
                      Reviewer: “{item.reviewNote}”
                    </p>
                  )}
                </div>

                {item.uploadId && (
                  <a
                    href={`/api/uploads/${item.uploadId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-teal underline underline-offset-4"
                  >
                    View submission
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

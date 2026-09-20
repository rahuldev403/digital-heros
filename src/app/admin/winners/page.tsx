import type { Metadata } from "next";

import { desc, eq } from "drizzle-orm";

import { NumberRow } from "@/components/ui/number-ball";
import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { drawEntries, drawWinners, draws, users, winnerVerifications } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";

import { WinnerControls } from "./_components/winner-controls";

export const metadata: Metadata = { title: "Winner verification" };

/**
 * Winners management — PRD §11.04 and §09.
 *
 * Full winners list, proof review, and payout marking. Only published draws
 * appear: a winner of an unpublished simulation does not exist yet.
 */
export default async function AdminWinnersPage() {
  await requireAdmin();

  const rows = await db
    .select({
      id: drawWinners.id,
      tier: drawWinners.tier,
      matchedNumbers: drawWinners.matchedNumbers,
      prizeMinor: drawWinners.prizeMinor,
      currency: drawWinners.currency,
      verificationStatus: drawWinners.verificationStatus,
      payoutStatus: drawWinners.payoutStatus,
      paidAt: drawWinners.paidAt,
      payoutReference: drawWinners.payoutReference,
      fullName: users.fullName,
      email: users.email,
      drawName: draws.name,
      winningNumbers: draws.winningNumbers,
      entryNumbers: drawEntries.numbers,
      proofUploadId: winnerVerifications.uploadId,
      proofNote: winnerVerifications.note,
    })
    .from(drawWinners)
    .innerJoin(users, eq(drawWinners.userId, users.id))
    .innerJoin(draws, eq(drawWinners.drawId, draws.id))
    .innerJoin(drawEntries, eq(drawWinners.entryId, drawEntries.id))
    .leftJoin(
      winnerVerifications,
      eq(winnerVerifications.drawWinnerId, drawWinners.id),
    )
    .where(eq(draws.status, "published"))
    .orderBy(desc(drawWinners.createdAt), desc(drawWinners.tier));

  const awaiting = rows.filter((r) => r.payoutStatus === "pending").length;
  const owed = rows
    .filter((r) => r.payoutStatus === "pending")
    .reduce((sum, r) => sum + r.prizeMinor, 0);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Winners</h1>
        <p className="text-ink-soft">
          {rows.length} total · {awaiting} awaiting payout
          {owed > 0 && ` · ${formatMoney(owed, rows[0]?.currency ?? "EUR")} outstanding`}
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-12 text-center text-ink-soft">
          No winners yet. Publish a draw and any winners appear here for
          verification.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id} className="card-retro overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-cream-deep px-5 py-3">
                <div>
                  <p className="font-semibold">{row.fullName}</p>
                  <p className="text-sm text-ink-soft">
                    {row.email} · {row.drawName}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={row.verificationStatus} />
                  <StatusPill status={row.payoutStatus} />
                  <span className="rounded-xl border-2 border-ink bg-mustard px-3 py-1 font-mono font-bold tabular shadow-retro-sm">
                    {formatMoney(row.prizeMinor, row.currency)}
                  </span>
                </div>
              </div>

              <div className="grid gap-5 p-5 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                      Their numbers — matched {row.tier}
                    </p>
                    <NumberRow
                      numbers={row.entryNumbers}
                      matchedNumbers={row.winningNumbers ?? []}
                      tone="plum"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                      Drawn
                    </p>
                    <NumberRow numbers={row.winningNumbers ?? []} tone="teal" />
                  </div>

                  {row.proofUploadId ? (
                    <a
                      href={`/api/uploads/${row.proofUploadId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-sm font-semibold text-teal underline underline-offset-4"
                    >
                      View submitted proof
                    </a>
                  ) : (
                    <p className="text-sm text-ink-faint">No proof submitted yet.</p>
                  )}

                  {row.proofNote && (
                    <p className="rounded-lg border-2 border-dashed border-ink/20 px-3 py-2 text-sm text-ink-soft">
                      “{row.proofNote}”
                    </p>
                  )}
                </div>

                <div>
                  <WinnerControls
                    winnerId={row.id}
                    verificationStatus={row.verificationStatus}
                    payoutStatus={row.payoutStatus}
                  />

                  {row.payoutStatus === "paid" && row.payoutReference && (
                    <p className="mt-2 font-mono text-xs text-ink-faint">
                      ref {row.payoutReference}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

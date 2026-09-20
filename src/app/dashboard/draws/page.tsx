import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { NumberRow } from "@/components/ui/number-ball";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { listUserEntries } from "@/lib/services/draws";

export const metadata: Metadata = { title: "Your draws" };

const VERIFICATION_COPY: Record<string, string> = {
  pending: "Upload proof to claim",
  submitted: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected — submit again",
};

/**
 * Participation history — PRD §10 "Participation summary" and "Winnings
 * overview".
 *
 * Shows every draw the player has entered, the numbers they held at the time
 * (the snapshot, not their current scores), and what happened.
 */
export default async function UserDrawsPage() {
  const user = await requireUser("/dashboard/draws");
  const entries = await listUserEntries(user.id, 24);

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Your draws</h1>
        <p className="max-w-2xl text-ink-soft">
          Every draw you have been entered in, and the numbers you held at the
          time.
        </p>
      </header>

      {entries.length === 0 ? (
        <div className="card-retro space-y-4 bg-cream-deep p-10 text-center">
          <p className="text-lg font-semibold">You have not been in a draw yet.</p>
          <p className="text-ink-soft">
            Log five rounds and you are entered in the next one automatically.
          </p>
          <div className="flex justify-center">
            <Button as={Link} href="/dashboard/scores" size="lg">
              Log a round
            </Button>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {entries.map((entry) => {
            const isPublished = entry.status === "published";
            const won = isPublished && entry.prizeMinor !== null;

            return (
              <li
                key={entry.drawId}
                className={`card-retro overflow-hidden ${won ? "bg-mustard" : "bg-paper"}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink px-5 py-3">
                  <div>
                    <h2 className="text-lg">{entry.name}</h2>
                    <p className="text-sm text-ink-soft">
                      {new Intl.DateTimeFormat("en-GB", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      }).format(entry.drawDate)}
                    </p>
                  </div>

                  {won ? (
                    <span className="rounded-xl border-2 border-ink bg-forest px-3.5 py-1.5 font-mono font-bold tabular text-cream shadow-retro-sm">
                      Won {formatMoney(entry.prizeMinor!, entry.currency)}
                    </span>
                  ) : (
                    <span className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                      {isPublished ? `Matched ${entry.matchCount ?? 0}` : "Not drawn yet"}
                    </span>
                  )}
                </div>

                <div className="space-y-4 p-5">
                  <div className="space-y-2">
                    <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                      Your numbers
                    </p>
                    <NumberRow
                      numbers={entry.numbers}
                      matchedNumbers={
                        isPublished ? (entry.winningNumbers ?? []) : []
                      }
                      tone="plum"
                    />
                  </div>

                  {isPublished && entry.winningNumbers && (
                    <div className="space-y-2">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                        Drawn
                      </p>
                      <NumberRow numbers={entry.winningNumbers} tone="teal" />
                    </div>
                  )}

                  {won && (
                    <div className="flex flex-wrap items-center gap-3 border-t-2 border-dashed border-ink/20 pt-4">
                      <span className="text-sm">
                        <strong>Claim status:</strong>{" "}
                        {VERIFICATION_COPY[entry.verificationStatus ?? "pending"]}
                      </span>
                      <span className="text-sm">
                        <strong>Payout:</strong>{" "}
                        {entry.payoutStatus === "paid" ? "Paid" : "Pending"}
                      </span>

                      {/*
                        Proof upload is not built yet, so no link is rendered
                        here — a button leading to a 404 is worse than no
                        button. The admin side of verification is complete; only
                        the claimant's upload is outstanding.
                      */}
                      {entry.verificationStatus !== "approved" && (
                        <span className="text-sm text-ink-faint">
                          Proof upload opens shortly — we will be in touch.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

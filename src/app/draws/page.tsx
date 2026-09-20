import type { Metadata } from "next";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { NumberRow } from "@/components/ui/number-ball";
import { TIER_SHARE_BPS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { currentPeriodKey, formatPeriod } from "@/lib/period";
import { calculatePool, listDrawWinners, listPublishedDraws } from "@/lib/services/draws";

export const metadata: Metadata = {
  title: "Draw results",
  description: "Published monthly draw results, winning numbers and prize pools.",
};

/**
 * Public draw results — PRD §06.
 *
 * Only published draws appear. A draw that has been simulated but not published
 * must not leak, or an admin could be accused of choosing which simulation to
 * release.
 */
export default async function DrawsPage() {
  const [published, livePool] = await Promise.all([
    listPublishedDraws(),
    calculatePool(currentPeriodKey()),
  ]);

  const winnersByDraw = await Promise.all(
    published.map((draw) => listDrawWinners(draw.id)),
  );

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-14">
        <div className="mx-auto max-w-4xl space-y-10">
          <header className="max-w-2xl space-y-4">
            <h1 className="text-5xl sm:text-6xl">
              The
              <span className="text-plum"> draw.</span>
            </h1>
            <p className="text-lg leading-relaxed text-ink-soft">
              Every month, five numbers are drawn from 1–45. Your five retained
              Stableford scores are your entry. Match three or more and you take
              a share of the pool.
            </p>
          </header>

          {/* Live pool for the period currently being funded. */}
          <section className="card-retro bg-ink p-6 text-cream">
            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-cream/60">
              {formatPeriod(currentPeriodKey())} — pool so far
            </p>
            <p className="mt-2 font-mono text-5xl font-bold tabular text-mustard">
              {formatMoney(livePool.totalMinor, "EUR")}
            </p>
            <div className="mt-4 flex flex-wrap gap-5 text-sm text-cream/70">
              <span>
                From subscriptions:{" "}
                <strong className="font-mono tabular text-cream">
                  {formatMoney(livePool.baseMinor, "EUR")}
                </strong>
              </span>
              {livePool.rolloverInMinor > 0 && (
                <span>
                  Rolled over:{" "}
                  <strong className="font-mono tabular text-mustard">
                    {formatMoney(livePool.rolloverInMinor, "EUR")}
                  </strong>
                </span>
              )}
              <span>
                Active members:{" "}
                <strong className="font-mono tabular text-cream">
                  {livePool.activeSubscribers}
                </strong>
              </span>
            </div>
          </section>

          <section className="space-y-5">
            <h2 className="text-3xl">Past results</h2>

            {published.length === 0 ? (
              <div className="card-retro bg-cream-deep p-10 text-center">
                <p className="text-lg font-semibold">No draws published yet.</p>
                <p className="mt-1 text-ink-soft">
                  The first result appears here once it is run and published.
                </p>
              </div>
            ) : (
              <ul className="space-y-5">
                {published.map((draw, index) => {
                  const winners = winnersByDraw[index];
                  const paidOut = winners.reduce((sum, w) => sum + w.prizeMinor, 0);

                  return (
                    <li key={draw.id} className="card-retro overflow-hidden">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-cream-deep px-5 py-3">
                        <h3 className="text-xl">{draw.name}</h3>
                        <span className="text-xs font-bold uppercase tracking-widest text-ink-soft">
                          {draw.mode === "algorithmic"
                            ? "Score-weighted"
                            : "Random"}{" "}
                          · {draw.entryCount} entries
                        </span>
                      </div>

                      <div className="space-y-5 p-5">
                        <div className="space-y-2">
                          <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                            Winning numbers
                          </p>
                          <NumberRow
                            numbers={draw.winningNumbers ?? []}
                            tone="teal"
                            size="lg"
                          />
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <PoolStat
                            label="Total pool"
                            value={formatMoney(draw.totalPoolMinor, draw.currency)}
                          />
                          <PoolStat
                            label="Paid to winners"
                            value={formatMoney(paidOut, draw.currency)}
                          />
                          <PoolStat
                            label="Rolled over"
                            value={formatMoney(draw.rolloverOutMinor, draw.currency)}
                            highlight={draw.rolloverOutMinor > 0}
                          />
                        </div>

                        {winners.length === 0 ? (
                          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-4 text-sm text-ink-soft">
                            Nobody matched three or more. The jackpot share (
                            {TIER_SHARE_BPS[5] / 100}%) rolled into the next
                            draw.
                          </p>
                        ) : (
                          <div className="space-y-2">
                            <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                              Winners
                            </p>
                            <ul className="divide-y-2 divide-dashed divide-ink/15">
                              {winners.map((winner) => (
                                <li
                                  key={winner.id}
                                  className="flex flex-wrap items-center justify-between gap-3 py-2.5"
                                >
                                  <div>
                                    {/* First name plus an initial — a winners
                                        list should not publish full identities. */}
                                    <span className="font-medium">
                                      {anonymise(winner.fullName)}
                                    </span>
                                    <span className="ml-2 text-sm text-ink-soft">
                                      matched {winner.tier}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold tabular text-forest">
                                    {formatMoney(winner.prizeMinor, winner.currency)}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {draw.randomSeed && (
                          <p className="border-t-2 border-dashed border-ink/20 pt-3 font-mono text-xs text-ink-faint">
                            Verifiable seed: {draw.randomSeed}
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function PoolStat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border-2 border-ink px-4 py-3 ${
        highlight ? "bg-mustard" : "bg-cream-deep"
      }`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 font-mono font-bold tabular">{value}</p>
    </div>
  );
}

/** "Rahul Sharma" → "Rahul S." */
function anonymise(fullName: string): string {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const lastInitial = rest.at(-1)?.[0];

  return lastInitial ? `${first} ${lastInitial}.` : first;
}

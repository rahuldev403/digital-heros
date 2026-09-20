import type { Metadata } from "next";

import { StatusPill } from "@/components/ui/status-pill";
import { NumberRow } from "@/components/ui/number-ball";
import { requireAdmin } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { listAllDraws, listDrawWinners, nextDrawPeriod } from "@/lib/services/draws";

import { CreateDrawForm, DrawOperations } from "./_components/draw-controls";

export const metadata: Metadata = { title: "Draw management" };

/**
 * Draw management — PRD §11.02: configure draw logic, run simulations, publish
 * results.
 */
export default async function AdminDrawsPage() {
  await requireAdmin();

  const [drawRows, defaultPeriod] = await Promise.all([
    listAllDraws(24),
    nextDrawPeriod(),
  ]);

  const winnersByDraw = await Promise.all(
    drawRows.map((draw) => listDrawWinners(draw.id)),
  );

  return (
    <div className="space-y-9">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Draws</h1>
        <p className="max-w-2xl text-ink-soft">
          Lock entries, simulate as often as you like, then publish. Nothing is
          visible to players until it is published.
        </p>
      </header>

      <CreateDrawForm defaultPeriod={defaultPeriod} />

      {drawRows.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-10 text-center text-ink-soft">
          No draws yet.
        </p>
      ) : (
        <ul className="space-y-5">
          {drawRows.map((draw, index) => {
            const winners = winnersByDraw[index];
            const paidOut = winners.reduce((sum, w) => sum + w.prizeMinor, 0);

            return (
              <li key={draw.id} className="card-retro overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-cream-deep px-5 py-3">
                  <div>
                    <h2 className="text-xl">{draw.name}</h2>
                    <p className="font-mono text-sm text-ink-soft">
                      {draw.periodKey} · {draw.mode}
                    </p>
                  </div>
                  <StatusPill status={draw.status} />
                </div>

                <div className="space-y-5 p-5">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <Metric label="Entries" value={String(draw.entryCount)} />
                    <Metric
                      label="Pool"
                      value={formatMoney(draw.totalPoolMinor, draw.currency)}
                    />
                    <Metric label="Winners" value={String(winners.length)} />
                    <Metric
                      label="Rolls over"
                      value={formatMoney(draw.rolloverOutMinor, draw.currency)}
                    />
                  </div>

                  {draw.winningNumbers && (
                    <div className="space-y-2">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                        {draw.status === "published" ? "Winning numbers" : "Simulated numbers (not public)"}
                      </p>
                      <NumberRow numbers={draw.winningNumbers} tone="teal" />
                      {draw.randomSeed && (
                        <p className="font-mono text-xs text-ink-faint">
                          seed {draw.randomSeed}
                        </p>
                      )}
                    </div>
                  )}

                  {winners.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                        Winners — {formatMoney(paidOut, draw.currency)} total
                      </p>
                      <ul className="divide-y-2 divide-dashed divide-ink/15 text-sm">
                        {winners.slice(0, 8).map((winner) => (
                          <li
                            key={winner.id}
                            className="flex flex-wrap items-center justify-between gap-3 py-2"
                          >
                            <span>
                              <strong>{winner.fullName}</strong>
                              <span className="ml-2 text-ink-soft">
                                matched {winner.tier}
                              </span>
                            </span>
                            <span className="font-mono font-bold tabular">
                              {formatMoney(winner.prizeMinor, winner.currency)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {winners.length > 8 && (
                        <p className="text-sm text-ink-faint">
                          + {winners.length - 8} more
                        </p>
                      )}
                    </div>
                  )}

                  <DrawOperations
                    drawId={draw.id}
                    status={draw.status}
                    mode={draw.mode}
                    entryCount={draw.entryCount}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border-2 border-ink bg-cream-deep px-4 py-3">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 font-mono font-bold tabular">{value}</p>
    </div>
  );
}

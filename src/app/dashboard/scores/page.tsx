import type { Metadata } from "next";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { NumberBall } from "@/components/ui/number-ball";
import { MIN_SCORES_FOR_ENTRY, SCORES_RETAINED } from "@/lib/constants";
import { requireUser } from "@/lib/dal";
import { listScores } from "@/lib/services/scores";

import { deleteScoreAction } from "./actions";
import { ScoreForm } from "./_components/score-form";

export const metadata: Metadata = { title: "Your scores" };

/**
 * Score management — PRD §05.
 *
 * Shows the retained set newest-first, makes the rolling-five rule visible
 * rather than surprising, and states plainly how close the player is to being
 * draw-eligible.
 */
export default async function ScoresPage() {
  const user = await requireUser("/dashboard/scores");
  const rows = await listScores(user.id);

  const remaining = Math.max(0, MIN_SCORES_FOR_ENTRY - rows.length);
  const atCapacity = rows.length >= SCORES_RETAINED;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">Your scores</h1>
        <p className="max-w-2xl text-ink-soft">
          We keep your latest {SCORES_RETAINED}. They are your numbers in every
          monthly draw — log a new round and it replaces your oldest.
        </p>
      </header>

      {/* Eligibility, stated plainly. */}
      <div
        className={`rounded-2xl border-2 border-ink p-5 shadow-retro ${
          remaining === 0 ? "bg-forest text-cream" : "bg-mustard"
        }`}
      >
        <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
          Draw eligibility
        </p>
        <p className="mt-1.5 text-lg font-semibold">
          {remaining === 0
            ? "You have a full set — you are entered in the next draw."
            : `${remaining} more ${remaining === 1 ? "round" : "rounds"} and you are in the next draw.`}
        </p>
      </div>

      <ScoreForm atCapacity={atCapacity} />

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Retained rounds</h2>
          <span className="font-mono text-sm font-bold tabular text-ink-faint">
            {rows.length} / {SCORES_RETAINED}
          </span>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-8 text-center text-ink-soft">
            No rounds logged yet. Add your first above.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((score, index) => (
              <li
                key={score.id}
                className="card-retro flex flex-wrap items-center gap-4 p-4"
              >
                <NumberBall value={score.points} tone="plum" />

                <div className="min-w-40 flex-1">
                  <p className="font-semibold">
                    {new Intl.DateTimeFormat("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(`${score.playedOn}T00:00:00Z`))}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {score.courseName ?? "Course not recorded"}
                  </p>
                </div>

                {/* The oldest is the one a new round will evict. */}
                {index === rows.length - 1 && atCapacity && (
                  <span className="rounded-full border-2 border-ink bg-cream-deep px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-widest">
                    Next to drop
                  </span>
                )}

                <form action={deleteScoreAction}>
                  <input type="hidden" name="scoreId" value={score.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete round from ${score.playedOn}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";

import { CheckCircle2, Plus } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NumberBall } from "@/components/ui/number-ball";
import { SCORE_MAX, SCORE_MIN, SCORES_RETAINED } from "@/lib/constants";

import { addScoreAction, type ScoreFormState } from "../actions";

/**
 * Add-a-round form.
 *
 * The score previews as a draw number while it is typed, because that is the
 * whole point of the product — the value you enter is the value that gets drawn
 * (decision D1). Watching the ball appear makes that legible without a
 * paragraph explaining it.
 */
export function ScoreForm({ atCapacity }: { atCapacity: boolean }) {
  const [state, formAction, isPending] = useActionState<ScoreFormState, FormData>(
    addScoreAction,
    { status: "idle" },
  );

  return (
    <form action={formAction} className="card-retro space-y-5 p-6">
      <div>
        <h2 className="text-2xl">Log a round</h2>
        <p className="mt-1 text-sm text-ink-soft">
          {atCapacity
            ? `You are holding ${SCORES_RETAINED}. A new round replaces your oldest.`
            : `Stableford points, ${SCORE_MIN}–${SCORE_MAX}. One round per date.`}
        </p>
      </div>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ink bg-danger px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          role="status"
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-forest px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {state.message}
        </motion.p>
      )}

      {/*
        Remounted on every successful submit, which clears both the uncontrolled
        inputs and the controlled points value. Keying the fields is what lets
        this avoid resetting state from inside an effect.
      */}
      <ScoreFields
        key={state.status === "success" ? state.token : "initial"}
        errorField={state.status === "error" ? state.field : undefined}
        errorMessage={state.status === "error" ? state.message : undefined}
      />

      <Button type="submit" size="lg" loading={isPending}>
        <Plus className="size-4" aria-hidden />
        {isPending ? "Saving…" : "Log this round"}
      </Button>
    </form>
  );
}

function ScoreFields({
  errorField,
  errorMessage,
}: {
  errorField?: string;
  errorMessage?: string;
}) {
  const [points, setPoints] = useState("");

  const parsed = Number(points);
  const showPreview =
    points !== "" &&
    Number.isInteger(parsed) &&
    parsed >= SCORE_MIN &&
    parsed <= SCORE_MAX;

  const today = new Date().toISOString().slice(0, 10);

  const errorsFor = (field: string) =>
    errorField === field && errorMessage ? [errorMessage] : undefined;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field
          label="Date played"
          name="playedOn"
          type="date"
          required
          max={today}
          defaultValue={today}
          errors={errorsFor("playedOn")}
        />

        <Field
          label="Stableford points"
          name="points"
          type="number"
          inputMode="numeric"
          required
          min={SCORE_MIN}
          max={SCORE_MAX}
          placeholder="32"
          value={points}
          onChange={(event) => setPoints(event.target.value)}
          errors={errorsFor("points")}
        />

        <Field
          label="Course (optional)"
          name="courseName"
          placeholder="Royal Calcutta"
        />
      </div>

      {showPreview && (
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 18 }}
          className="flex items-center gap-3 rounded-xl border-2 border-dashed border-ink/25 px-4 py-3"
        >
          <NumberBall value={parsed} tone="plum" />
          <p className="text-sm text-ink-soft">
            This becomes one of your five draw numbers.
          </p>
        </motion.div>
      )}
    </div>
  );
}

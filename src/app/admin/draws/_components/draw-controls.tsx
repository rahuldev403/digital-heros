"use client";

import { useActionState } from "react";

import { CheckCircle2, Dices, Lock, RotateCcw, Send } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  createDrawAction,
  lockEntriesAction,
  publishDrawAction,
  resetDrawAction,
  simulateDrawAction,
  type AdminActionState,
} from "../actions";

/**
 * Draw operation controls — PRD §06 OPERATIONS.
 *
 * Each operation is its own form with its own action state, so a failure in one
 * does not clear the feedback from another. The publish button asks for
 * confirmation because publishing is irreversible and makes money claimable.
 */

function Feedback({ state }: { state: AdminActionState }) {
  if (state.status === "idle") return null;

  const isError = state.status === "error";

  return (
    <p
      role={isError ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border-2 border-ink px-3.5 py-2.5 text-sm font-medium ${
        isError ? "bg-danger text-cream" : "bg-forest text-cream"
      }`}
    >
      {!isError && <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />}
      {state.message}
    </p>
  );
}

export function CreateDrawForm({ defaultPeriod }: { defaultPeriod: string }) {
  const [state, action, isPending] = useActionState<AdminActionState, FormData>(
    createDrawAction,
    { status: "idle" },
  );

  return (
    <form action={action} className="card-retro space-y-4 p-6">
      <h2 className="text-2xl">Create a draw</h2>
      <Feedback state={state} />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label
            htmlFor="periodKey"
            className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
          >
            Period
          </label>
          <input
            id="periodKey"
            name="periodKey"
            defaultValue={defaultPeriod}
            placeholder="2026-09"
            pattern="\d{4}-(0[1-9]|1[0-2])"
            required
            className="h-12 w-40 rounded-xl border-2 border-ink bg-paper px-3.5 font-mono tabular focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="mode"
            className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
          >
            Draw logic
          </label>
          <select
            id="mode"
            name="mode"
            defaultValue="random"
            className="h-12 appearance-none rounded-xl border-2 border-ink bg-paper px-3.5 focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
          >
            <option value="random">Random — standard lottery</option>
            <option value="algorithmic">Algorithmic — weighted by score frequency</option>
          </select>
        </div>

        <Button type="submit" size="lg" loading={isPending}>
          Create
        </Button>
      </div>
    </form>
  );
}

export function DrawOperations({
  drawId,
  status,
  mode,
  entryCount,
}: {
  drawId: string;
  status: "draft" | "simulated" | "published";
  mode: "random" | "algorithmic";
  entryCount: number;
}) {
  const [lockState, lockAction, lockPending] = useActionState<AdminActionState, FormData>(
    lockEntriesAction,
    { status: "idle" },
  );
  const [simState, simAction, simPending] = useActionState<AdminActionState, FormData>(
    simulateDrawAction,
    { status: "idle" },
  );
  const [pubState, pubAction, pubPending] = useActionState<AdminActionState, FormData>(
    publishDrawAction,
    { status: "idle" },
  );
  const [resetState, resetAction, resetPending] = useActionState<AdminActionState, FormData>(
    resetDrawAction,
    { status: "idle" },
  );

  if (status === "published") {
    return (
      <p className="rounded-xl border-2 border-dashed border-ink/25 px-4 py-3 text-sm text-ink-soft">
        Published draws are final and cannot be changed.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Feedback state={lockState} />
      <Feedback state={simState} />
      <Feedback state={pubState} />
      <Feedback state={resetState} />

      <div className="flex flex-wrap gap-2">
        {/* 1 — lock entries */}
        <form action={lockAction}>
          <input type="hidden" name="drawId" value={drawId} />
          <Button type="submit" variant="secondary" size="sm" loading={lockPending}>
            <Lock className="size-3.5" aria-hidden />
            {entryCount > 0 ? "Re-lock entries" : "Lock entries"}
          </Button>
        </form>

        {/* 2 — simulate (repeatable) */}
        <form action={simAction} className="flex items-center gap-2">
          <input type="hidden" name="drawId" value={drawId} />
          <select
            name="mode"
            defaultValue={mode}
            aria-label="Draw logic"
            className="h-9 appearance-none rounded-lg border-2 border-ink bg-paper px-2.5 text-sm focus:outline-none"
          >
            <option value="random">Random</option>
            <option value="algorithmic">Algorithmic</option>
          </select>
          <Button
            type="submit"
            size="sm"
            loading={simPending}
            disabled={entryCount === 0}
          >
            <Dices className="size-3.5" aria-hidden />
            {status === "simulated" ? "Re-run" : "Simulate"}
          </Button>
        </form>

        {/* 3 — publish (one-way) */}
        {status === "simulated" && (
          <>
            <form
              action={pubAction}
              onSubmit={(event) => {
                if (
                  !confirm(
                    "Publish this draw? Results become public and prizes become claimable. This cannot be undone.",
                  )
                ) {
                  event.preventDefault();
                }
              }}
            >
              <input type="hidden" name="drawId" value={drawId} />
              <Button type="submit" variant="dark" size="sm" loading={pubPending}>
                <Send className="size-3.5" aria-hidden />
                Publish
              </Button>
            </form>

            <form action={resetAction}>
              <input type="hidden" name="drawId" value={drawId} />
              <Button type="submit" variant="ghost" size="sm" loading={resetPending}>
                <RotateCcw className="size-3.5" aria-hidden />
                Reset
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

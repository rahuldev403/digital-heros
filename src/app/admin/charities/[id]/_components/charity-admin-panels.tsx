"use client";

import { useActionState } from "react";

import { CheckCircle2, Star, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";

import {
  createEventAction,
  deleteCharityAction,
  setSpotlightAction,
  type CharityAdminState,
} from "../../actions";

function Feedback({ state }: { state: CharityAdminState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-xl border-2 border-ink px-3.5 py-2.5 text-sm font-medium ${
        state.status === "error" ? "bg-danger text-cream" : "bg-forest text-cream"
      }`}
    >
      {state.status === "success" && (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      {state.message}
    </p>
  );
}

/** Promotes a charity into the single homepage spotlight slot (PRD §08.2). */
export function SpotlightButton({
  charityId,
  isFeatured,
}: {
  charityId: string;
  isFeatured: boolean;
}) {
  const [state, action, isPending] = useActionState<CharityAdminState, FormData>(
    setSpotlightAction,
    { status: "idle" },
  );

  if (isFeatured) {
    return (
      <p className="inline-flex items-center gap-2 rounded-xl border-2 border-ink bg-mustard px-3.5 py-2 text-sm font-bold uppercase tracking-widest">
        <Star className="size-4" aria-hidden />
        In the spotlight
      </p>
    );
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="charityId" value={charityId} />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" size="sm" loading={isPending}>
        <Star className="size-3.5" aria-hidden />
        Make this the spotlight
      </Button>
    </form>
  );
}

/**
 * Delete control.
 *
 * The server decides between a hard delete and a deactivation based on whether
 * anything references the charity, so the confirmation text has to cover both
 * outcomes honestly rather than promising deletion it may not perform.
 */
export function DeleteCharityButton({
  charityId,
  name,
  hasHistory,
}: {
  charityId: string;
  name: string;
  hasHistory: boolean;
}) {
  const [state, action, isPending] = useActionState<CharityAdminState, FormData>(
    deleteCharityAction,
    { status: "idle" },
  );

  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(event) => {
        const message = hasHistory
          ? `“${name}” has funding history, so it will be deactivated rather than deleted — its past contributions stay on record. Continue?`
          : `Permanently delete “${name}”? This cannot be undone.`;

        if (!confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="charityId" value={charityId} />
      <Feedback state={state} />

      <div className="space-y-1.5">
        <Button type="submit" variant="danger" size="sm" loading={isPending}>
          <Trash2 className="size-3.5" aria-hidden />
          {hasHistory ? "Deactivate charity" : "Delete charity"}
        </Button>
        <p className="text-xs text-ink-faint">
          {hasHistory
            ? "Members support this cause or payments reference it, so its record is kept."
            : "Nothing references this charity yet, so it can be removed outright."}
        </p>
      </div>
    </form>
  );
}

/** Adds an upcoming event — PRD §08.2 ("golf days"). */
export function EventForm({ charityId }: { charityId: string }) {
  const [state, action, isPending] = useActionState<CharityAdminState, FormData>(
    createEventAction,
    { status: "idle" },
  );

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="charityId" value={charityId} />
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Title"
          name="title"
          required
          placeholder="Charity Golf Day"
          errors={errors?.title}
        />
        <Field
          label="Starts"
          name="startsAt"
          type="datetime-local"
          required
          errors={errors?.startsAt}
        />
        <Field label="Location" name="location" errors={errors?.location} />
        <Field
          label="Registration link"
          name="registrationUrl"
          type="url"
          placeholder="https://…"
          errors={errors?.registrationUrl}
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="description"
          className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
        >
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          className="w-full rounded-xl border-2 border-ink bg-paper px-3.5 py-2.5 focus:outline-none focus:shadow-[inset_3px_3px_0_0_var(--color-teal)]"
        />
      </div>

      <Button type="submit" size="sm" loading={isPending}>
        Add event
      </Button>
    </form>
  );
}

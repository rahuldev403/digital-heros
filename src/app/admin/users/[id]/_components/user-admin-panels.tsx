"use client";

import { useActionState, useState } from "react";

import { CheckCircle2, LogOut, Pencil, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { NumberBall } from "@/components/ui/number-ball";
import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT, SCORE_MAX, SCORE_MIN } from "@/lib/constants";

import {
  adminAddScoreAction,
  adminCancelSubscriptionAction,
  adminDeleteScoreAction,
  adminUpdateScoreAction,
  revokeSessionsAction,
  updateUserProfileAction,
  type UserAdminState,
} from "../../actions";

function Feedback({ state }: { state: UserAdminState }) {
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

const selectClass =
  "h-12 w-full appearance-none rounded-xl border-2 border-ink bg-paper px-3.5 focus:outline-none focus:shadow-[inset_3px_3px_0_0_var(--color-teal)]";

const labelClass = "block text-xs font-bold uppercase tracking-widest text-ink-soft";

// ---------------------------------------------------------------------------

export function ProfileForm({
  user,
  charities,
  isSelf,
}: {
  user: {
    id: string;
    fullName: string;
    email: string;
    role: "user" | "admin";
    status: "active" | "suspended";
    charityId: string | null;
    charityPercent: number;
  };
  charities: { id: string; name: string; isActive: boolean }[];
  isSelf: boolean;
}) {
  const [state, action, isPending] = useActionState<UserAdminState, FormData>(
    updateUserProfileAction,
    { status: "idle" },
  );

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={action} className="card-retro space-y-5 p-6">
      <input type="hidden" name="userId" value={user.id} />
      <h2 className="text-xl">Profile</h2>
      <Feedback state={state} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Full name"
          name="fullName"
          required
          defaultValue={user.fullName}
          errors={errors?.fullName}
        />
        <Field
          label="Email"
          name="email"
          type="email"
          required
          defaultValue={user.email}
          errors={errors?.email}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="role" className={labelClass}>
            Role
          </label>
          <select
            id="role"
            name="role"
            defaultValue={user.role}
            // Self-demotion is refused server-side; disabling the control says
            // so up front instead of after a round trip.
            disabled={isSelf}
            className={selectClass}
          >
            <option value="user">Subscriber</option>
            <option value="admin">Administrator</option>
          </select>
          {/* Disabled fields are not submitted, so carry the value explicitly. */}
          {isSelf && <input type="hidden" name="role" value={user.role} />}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="status" className={labelClass}>
            Account status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={user.status}
            disabled={isSelf}
            className={selectClass}
          >
            <option value="active">Active</option>
            <option value="suspended">Suspended — signs out everywhere</option>
          </select>
          {isSelf && <input type="hidden" name="status" value={user.status} />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="charityId" className={labelClass}>
            Charity
          </label>
          <select
            id="charityId"
            name="charityId"
            defaultValue={user.charityId ?? ""}
            className={selectClass}
          >
            <option value="">None</option>
            {charities.map((charity) => (
              <option key={charity.id} value={charity.id}>
                {charity.name}
                {!charity.isActive && " (inactive)"}
              </option>
            ))}
          </select>
        </div>

        <Field
          label="Contribution %"
          name="charityPercent"
          type="number"
          min={CHARITY_MIN_PERCENT}
          max={CHARITY_MAX_PERCENT}
          required
          defaultValue={String(user.charityPercent)}
          errors={errors?.charityPercent}
        />
      </div>

      {isSelf && (
        <p className="text-xs text-ink-faint">
          Role and status are locked on your own account, so you cannot lock
          yourself out.
        </p>
      )}

      <Button type="submit" loading={isPending}>
        Save profile
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

export function RevokeSessionsButton({ userId }: { userId: string }) {
  const [state, action, isPending] = useActionState<UserAdminState, FormData>(
    revokeSessionsAction,
    { status: "idle" },
  );

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <Feedback state={state} />
      <Button type="submit" variant="secondary" size="sm" loading={isPending}>
        <LogOut className="size-3.5" aria-hidden />
        Sign out everywhere
      </Button>
    </form>
  );
}

export function CancelSubscriptionButton({
  userId,
  isSeeded,
}: {
  userId: string;
  isSeeded: boolean;
}) {
  const [state, action, isPending] = useActionState<UserAdminState, FormData>(
    adminCancelSubscriptionAction,
    { status: "idle" },
  );

  return (
    <form
      action={action}
      className="space-y-2"
      onSubmit={(event) => {
        if (
          !confirm(
            isSeeded
              ? "Cancel this demo subscription at period end?"
              : "Cancel in Stripe at period end? They keep access until then, and will not be charged again.",
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="userId" value={userId} />
      <Feedback state={state} />
      <Button type="submit" variant="danger" size="sm" loading={isPending}>
        Cancel at period end
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------

export interface AdminScoreRow {
  id: string;
  playedOn: string;
  points: number;
  courseName: string | null;
}

/**
 * Score editor for one user — PRD §11.01 "Edit golf scores".
 *
 * Rows switch into an inline edit form one at a time. Every change goes
 * through the same score service a member's own edits use, so the 1–45 range,
 * one-per-date and rolling-five rules apply to admins too.
 */
export function ScoreEditor({
  userId,
  scores,
}: {
  userId: string;
  scores: AdminScoreRow[];
}) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const [addState, addAction, addPending] = useActionState<UserAdminState, FormData>(
    adminAddScoreAction,
    { status: "idle" },
  );

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section className="card-retro space-y-5 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-xl">Scores</h2>
        <span className="font-mono text-sm font-bold tabular text-ink-faint">
          {scores.length} / 5
        </span>
      </div>

      {scores.length === 0 ? (
        <p className="rounded-xl border-2 border-dashed border-ink-faint px-4 py-5 text-sm text-ink-soft">
          No scores logged.
        </p>
      ) : (
        <ul className="space-y-2">
          {scores.map((score) =>
            editingId === score.id ? (
              <ScoreEditRow
                key={score.id}
                userId={userId}
                score={score}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <li
                key={score.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-ink bg-cream-deep p-3"
              >
                <NumberBall value={score.points} tone="plum" size="sm" />
                <div className="min-w-32 flex-1">
                  <p className="font-semibold">{score.playedOn}</p>
                  <p className="text-sm text-ink-soft">{score.courseName ?? "—"}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingId(score.id)}
                  aria-label={`Edit score from ${score.playedOn}`}
                >
                  <Pencil className="size-4" aria-hidden />
                </Button>
                <form
                  action={adminDeleteScoreAction}
                  onSubmit={(event) => {
                    if (!confirm(`Delete the ${score.points}-point round from ${score.playedOn}?`)) {
                      event.preventDefault();
                    }
                  }}
                >
                  <input type="hidden" name="userId" value={userId} />
                  <input type="hidden" name="scoreId" value={score.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete score from ${score.playedOn}`}
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </form>
              </li>
            ),
          )}
        </ul>
      )}

      <form action={addAction} className="space-y-3 border-t-2 border-dashed border-ink/15 pt-5">
        <input type="hidden" name="userId" value={userId} />
        <p className={labelClass}>Add a score</p>
        <Feedback state={addState} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date" name="playedOn" type="date" max={today} defaultValue={today} required />
          <Field
            label="Points"
            name="points"
            type="number"
            min={SCORE_MIN}
            max={SCORE_MAX}
            required
          />
          <Field label="Course" name="courseName" />
          <div className="flex items-end">
            <Button type="submit" loading={addPending} fullWidth>
              Add
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function ScoreEditRow({
  userId,
  score,
  onDone,
}: {
  userId: string;
  score: AdminScoreRow;
  onDone: () => void;
}) {
  const [state, action, isPending] = useActionState<UserAdminState, FormData>(
    async (prev, formData) => {
      const result = await adminUpdateScoreAction(prev, formData);
      if (result.status === "success") onDone();
      return result;
    },
    { status: "idle" },
  );

  return (
    <li className="rounded-xl border-2 border-ink bg-paper p-3">
      <form action={action} className="space-y-3">
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="scoreId" value={score.id} />
        <Feedback state={state} />
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date" name="playedOn" type="date" defaultValue={score.playedOn} required />
          <Field
            label="Points"
            name="points"
            type="number"
            min={SCORE_MIN}
            max={SCORE_MAX}
            defaultValue={String(score.points)}
            required
          />
          <Field label="Course" name="courseName" defaultValue={score.courseName ?? ""} />
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm" loading={isPending}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDone} aria-label="Cancel edit">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </form>
    </li>
  );
}

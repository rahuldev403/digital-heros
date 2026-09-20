"use client";

import { useActionState, useState } from "react";

import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { AuthActionState } from "@/lib/validation/auth";

import { signUpAction } from "../actions";
import { FormStatus } from "./form-status";

export interface CharityOption {
  id: string;
  name: string;
  category: string;
}

/**
 * Sign-up form.
 *
 * Charity choice is part of creating the account, not a later settings screen,
 * because the PRD makes it part of signup (§08.1) — and because asking someone
 * to pick a cause while they are deciding to join is what makes the
 * contribution feel like the point rather than a deduction.
 */
export function SignupForm({
  charities,
  next,
}: {
  charities: CharityOption[];
  next?: string;
}) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    signUpAction,
    { status: "idle" },
  );

  const [percent, setPercent] = useState(CHARITY_MIN_PERCENT);

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <FormStatus state={state} />

      <Field
        label="Full name"
        name="fullName"
        autoComplete="name"
        placeholder="Alex Morgan"
        required
        errors={fieldErrors?.fullName}
      />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        errors={fieldErrors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 10 characters"
        required
        errors={fieldErrors?.password}
        hint="Ten characters or more. Length matters more than symbols."
      />

      {/* --- Charity selection (PRD §08.1) --- */}
      <div className="space-y-2">
        <label htmlFor="charityId" className="block text-sm font-medium text-ink">
          Choose your cause
          <span className="ml-1 text-ember" aria-hidden>
            *
          </span>
        </label>

        <select
          id="charityId"
          name="charityId"
          required
          defaultValue=""
          aria-invalid={fieldErrors?.charityId ? true : undefined}
          className={cn(
            "w-full h-11 px-3.5 rounded-xl appearance-none",
            "bg-surface border text-ink transition-colors duration-200",
            "focus:outline-none focus:border-mint/60",
            "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-mint)_20%,transparent)]",
            fieldErrors?.charityId ? "border-danger/60" : "border-line",
          )}
        >
          <option value="" disabled>
            Select a charity…
          </option>
          {charities.map((charity) => (
            <option key={charity.id} value={charity.id}>
              {charity.name} — {charity.category}
            </option>
          ))}
        </select>

        {fieldErrors?.charityId && (
          <p className="text-sm text-danger">{fieldErrors.charityId.join(". ")}</p>
        )}
      </div>

      {/* --- Contribution percentage --- */}
      <div className="space-y-3 rounded-xl border border-line bg-surface/60 p-4">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="charityPercent"
            className="flex items-center gap-2 text-sm font-medium text-ink"
          >
            <Heart className="size-4 text-ember" aria-hidden />
            Your contribution
          </label>
          <output
            htmlFor="charityPercent"
            className="tabular text-2xl font-semibold text-mint"
          >
            {percent}%
          </output>
        </div>

        <input
          id="charityPercent"
          name="charityPercent"
          type="range"
          min={CHARITY_MIN_PERCENT}
          max={CHARITY_MAX_PERCENT}
          step={5}
          value={percent}
          onChange={(event) => setPercent(Number(event.target.value))}
          className="w-full accent-[var(--color-mint)]"
        />

        <p className="text-sm text-faint">
          {percent === CHARITY_MIN_PERCENT
            ? `${CHARITY_MIN_PERCENT}% is the minimum. Move the slider to give more.`
            : `Thank you — that is ${percent - CHARITY_MIN_PERCENT}% above the minimum.`}
        </p>

        {fieldErrors?.charityPercent && (
          <p className="text-sm text-danger">
            {fieldErrors.charityPercent.join(". ")}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" fullWidth loading={isPending}>
        {isPending ? "Creating your account…" : "Create account"}
      </Button>

      <p className="text-center text-xs leading-relaxed text-faint">
        You can change your cause or your percentage at any time.
      </p>
    </form>
  );
}

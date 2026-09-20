"use client";

import { useActionState, useState } from "react";

import { CheckCircle2, Heart } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "@/lib/constants";
import { formatMoney } from "@/lib/money";

import { updateCharityAction, type CharityFormState } from "../actions";

export interface CharityChoice {
  id: string;
  name: string;
  category: string;
  tagline: string | null;
}

/**
 * Charity and contribution settings.
 *
 * The percentage slider shows what the choice is actually worth in money, using
 * the user's real plan price. "20%" is an abstraction; "€2.00 of every €9.99"
 * is a decision someone can actually make.
 */
export function CharitySettingsForm({
  charities,
  currentCharityId,
  currentPercent,
  planPriceMinor,
  currency,
}: {
  charities: CharityChoice[];
  currentCharityId: string | null;
  currentPercent: number;
  planPriceMinor: number | null;
  currency: string;
}) {
  const [state, formAction, isPending] = useActionState<CharityFormState, FormData>(
    updateCharityAction,
    { status: "idle" },
  );

  const [percent, setPercent] = useState(currentPercent);
  const [selected, setSelected] = useState(currentCharityId ?? "");

  const perPayment = planPriceMinor
    ? Math.round((planPriceMinor * percent) / 100)
    : null;

  return (
    <form action={formAction} className="space-y-6">
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

      {/* Cause picker as radio cards — the choice is emotional, so it gets
          room rather than being hidden in a dropdown. */}
      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Your cause
        </legend>

        <div className="grid gap-3 sm:grid-cols-2">
          {charities.map((charity) => {
            const isSelected = selected === charity.id;

            return (
              <label
                key={charity.id}
                className={`card-retro cursor-pointer p-4 transition-transform ${
                  isSelected
                    ? "bg-forest text-cream -translate-x-0.5 -translate-y-0.5 shadow-retro-lg"
                    : "bg-paper hover:-translate-y-0.5"
                }`}
              >
                <input
                  type="radio"
                  name="charityId"
                  value={charity.id}
                  checked={isSelected}
                  onChange={() => setSelected(charity.id)}
                  className="sr-only"
                />
                <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-70">
                  {charity.category}
                </p>
                <p className="mt-1 font-semibold">{charity.name}</p>
                {charity.tagline && (
                  <p
                    className={`mt-0.5 text-sm ${isSelected ? "text-cream/80" : "text-ink-soft"}`}
                  >
                    {charity.tagline}
                  </p>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      {/* Percentage */}
      <div className="card-retro space-y-3 bg-cream-deep p-5">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="charityPercent"
            className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-ink-soft"
          >
            <Heart className="size-4 text-orange" aria-hidden />
            Contribution
          </label>
          <output
            htmlFor="charityPercent"
            className="font-mono text-3xl font-bold tabular text-forest"
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
          className="w-full accent-orange"
        />

        <p className="text-sm text-ink-soft">
          {perPayment !== null ? (
            <>
              <strong className="font-mono tabular">
                {formatMoney(perPayment, currency)}
              </strong>{" "}
              of every {formatMoney(planPriceMinor!, currency)} payment goes to
              your cause.
            </>
          ) : (
            `${CHARITY_MIN_PERCENT}% is the minimum. Subscribe to see what that is worth.`
          )}
        </p>

        <p className="text-xs text-ink-faint">
          The maximum is {CHARITY_MAX_PERCENT}% — the prize pool is funded before
          the charity split, so it cannot be reduced by one member giving more.
        </p>
      </div>

      <Button type="submit" size="lg" loading={isPending}>
        {isPending ? "Saving…" : "Save changes"}
      </Button>

      <p className="text-sm text-ink-faint">
        Changes apply to future payments. What you have already given stays with
        the charity that received it.
      </p>
    </form>
  );
}

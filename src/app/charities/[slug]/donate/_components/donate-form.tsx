"use client";

import { useActionState, useState } from "react";

import { Heart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

import { startDonationAction, type DonateState } from "../actions";

const PRESETS = [5, 10, 25, 50];

/**
 * One-off donation form — PRD §08.1.
 *
 * Presets make the common case one tap; a custom field covers the rest. The
 * amount chosen here is only a suggestion to the server, which re-validates
 * the floor and ceiling before anything reaches Stripe.
 */
export function DonateForm({
  charitySlug,
  charityName,
  signedIn,
}: {
  charitySlug: string;
  charityName: string;
  signedIn: boolean;
}) {
  const [state, action, isPending] = useActionState<DonateState, FormData>(
    startDonationAction,
    { status: "idle" },
  );

  const [amount, setAmount] = useState("10");

  return (
    <form action={action} className="card-retro space-y-6 p-6">
      <input type="hidden" name="charitySlug" value={charitySlug} />

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ink bg-danger px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          {state.message}
        </p>
      )}

      <fieldset className="space-y-3">
        <legend className="text-xs font-bold uppercase tracking-widest text-ink-soft">
          Amount
        </legend>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              aria-pressed={amount === String(preset)}
              className={cn(
                "h-12 rounded-xl border-2 border-ink font-mono text-lg font-bold tabular",
                "transition-[transform,background-color] duration-150",
                amount === String(preset)
                  ? "bg-forest text-cream shadow-retro-sm"
                  : "bg-paper hover:-translate-y-0.5",
              )}
            >
              €{preset}
            </button>
          ))}
        </div>

        <Field
          label="Or enter an amount (€)"
          name="amount"
          type="number"
          inputMode="decimal"
          min={1}
          step="0.01"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </fieldset>

      {!signedIn && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Your name (optional)" name="donorName" autoComplete="name" />
          <Field
            label="Email for a receipt (optional)"
            name="donorEmail"
            type="email"
            autoComplete="email"
          />
        </div>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor="message"
          className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
        >
          A note to {charityName} (optional)
        </label>
        <textarea
          id="message"
          name="message"
          rows={3}
          maxLength={500}
          className="w-full rounded-xl border-2 border-ink bg-paper px-3.5 py-2.5 focus:outline-none focus:shadow-[inset_3px_3px_0_0_var(--color-teal)]"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-3 text-sm">
        <input type="checkbox" name="isAnonymous" className="size-5 accent-orange" />
        Give anonymously
      </label>

      <Button type="submit" size="lg" fullWidth loading={isPending}>
        <Heart className="size-4" aria-hidden />
        {isPending ? "Opening Stripe…" : `Donate €${amount || "0"}`}
      </Button>

      <p className="text-center text-xs text-ink-faint">
        A one-off gift. It does not enter you in any draw, and none of it goes to
        the prize pool — all of it goes to {charityName}.
      </p>
    </form>
  );
}

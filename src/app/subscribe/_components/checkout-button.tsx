"use client";

import { useActionState } from "react";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

import { startCheckoutAction, type CheckoutState } from "../actions";

/**
 * Checkout launcher.
 *
 * A form rather than an onClick fetch: the plan code travels as form data to a
 * server action, so the price is never chosen by client JavaScript. A client
 * that could name its own price would be able to name a cheaper one.
 */
export function CheckoutButton({
  planCode,
  label,
}: {
  planCode: string;
  label: string;
}) {
  const [state, action, isPending] = useActionState<CheckoutState, FormData>(
    startCheckoutAction,
    { status: "idle" },
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="planCode" value={planCode} />

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ink bg-danger px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          {state.message}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth loading={isPending}>
        {isPending ? "Opening Stripe…" : label}
        {!isPending && <ArrowRight className="size-4" aria-hidden />}
      </Button>
    </form>
  );
}

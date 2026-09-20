"use client";

import { useActionState } from "react";

import { BadgeCheck, Ban, Banknote } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  markPaidAction,
  reviewClaimAction,
  type WinnerActionState,
} from "../actions";

function Feedback({ state }: { state: WinnerActionState }) {
  if (state.status === "idle") return null;

  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={`rounded-xl border-2 border-ink px-3 py-2 text-sm font-medium ${
        state.status === "error" ? "bg-danger text-cream" : "bg-forest text-cream"
      }`}
    >
      {state.message}
    </p>
  );
}

/**
 * Review and payout controls for one winner.
 *
 * The payout button only appears once the claim is approved — the server
 * enforces that ordering too, but showing an action that will be refused is a
 * worse experience than not showing it.
 */
export function WinnerControls({
  winnerId,
  verificationStatus,
  payoutStatus,
}: {
  winnerId: string;
  verificationStatus: "pending" | "submitted" | "approved" | "rejected";
  payoutStatus: "pending" | "paid";
}) {
  const [reviewState, reviewAction, reviewPending] = useActionState<
    WinnerActionState,
    FormData
  >(reviewClaimAction, { status: "idle" });

  const [payState, payAction, payPending] = useActionState<WinnerActionState, FormData>(
    markPaidAction,
    { status: "idle" },
  );

  if (payoutStatus === "paid") {
    return (
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-forest">
        <BadgeCheck className="size-4" aria-hidden />
        Paid
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <Feedback state={reviewState} />
      <Feedback state={payState} />

      {verificationStatus !== "approved" ? (
        <form action={reviewAction} className="space-y-2">
          <input type="hidden" name="winnerId" value={winnerId} />

          <input
            name="reviewNote"
            placeholder="Note (optional)"
            className="h-10 w-full rounded-lg border-2 border-ink bg-paper px-3 text-sm focus:outline-none"
          />

          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              name="decision"
              value="approved"
              size="sm"
              loading={reviewPending}
              disabled={verificationStatus === "pending"}
            >
              <BadgeCheck className="size-3.5" aria-hidden />
              Approve
            </Button>
            <Button
              type="submit"
              name="decision"
              value="rejected"
              variant="danger"
              size="sm"
              disabled={verificationStatus === "pending"}
            >
              <Ban className="size-3.5" aria-hidden />
              Reject
            </Button>
          </div>

          {verificationStatus === "pending" && (
            <p className="text-xs text-ink-faint">
              Waiting for the winner to upload proof of their scores.
            </p>
          )}
        </form>
      ) : (
        <form action={payAction} className="space-y-2">
          <input type="hidden" name="winnerId" value={winnerId} />
          <input
            name="payoutReference"
            placeholder="Payment reference"
            className="h-10 w-full rounded-lg border-2 border-ink bg-paper px-3 text-sm focus:outline-none"
          />
          <Button type="submit" variant="dark" size="sm" loading={payPending}>
            <Banknote className="size-3.5" aria-hidden />
            Mark paid
          </Button>
        </form>
      )}
    </div>
  );
}

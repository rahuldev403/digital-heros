import { cn } from "@/lib/utils";

/**
 * Status chip.
 *
 * One component for every lifecycle badge in the app — draw status,
 * subscription status, verification status, payout status — so the same state
 * never appears in two different colours on two different screens.
 */

const TONES: Record<string, string> = {
  // Draw lifecycle
  draft: "bg-cream-deep text-ink",
  simulated: "bg-mustard text-ink",
  published: "bg-forest text-cream",

  // Subscription lifecycle
  active: "bg-forest text-cream",
  incomplete: "bg-cream-deep text-ink",
  past_due: "bg-orange text-cream",
  canceled: "bg-cream-deep text-ink-soft",
  expired: "bg-cream-deep text-ink-soft",
  none: "bg-cream-deep text-ink-faint",

  // Verification / payout
  pending: "bg-cream-deep text-ink",
  submitted: "bg-teal text-cream",
  approved: "bg-forest text-cream",
  rejected: "bg-danger text-cream",
  paid: "bg-forest text-cream",

  // Account
  suspended: "bg-danger text-cream",
};

export function StatusPill({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full border-2 border-ink px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest",
        TONES[status] ?? "bg-cream-deep text-ink",
        className,
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

import { cn } from "@/lib/utils";

/**
 * A draw number.
 *
 * This is the product's central idea made visible: the number on the ball is a
 * Stableford score the player actually carded (see `DRAW_NUMBER_MIN` in
 * `lib/constants.ts`). Rendering scores and draw numbers with the same
 * component is intentional — it is the same value in both places, and the UI
 * should not imply otherwise.
 */

type Tone = "plum" | "mustard" | "teal" | "forest" | "muted";
type Size = "sm" | "md" | "lg";

const TONES: Record<Tone, string> = {
  plum: "bg-plum text-cream",
  mustard: "bg-mustard text-ink",
  teal: "bg-teal text-cream",
  forest: "bg-forest text-cream",
  muted: "bg-cream-deep text-ink-soft",
};

const SIZES: Record<Size, string> = {
  sm: "size-9 text-sm",
  md: "size-12 text-lg",
  lg: "size-16 text-2xl",
};

export function NumberBall({
  value,
  tone = "plum",
  size = "md",
  matched = false,
  className,
}: {
  value: number;
  tone?: Tone;
  size?: Size;
  /** Marks a number that matched the draw. */
  matched?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border-2 border-ink",
        "font-mono font-bold tabular shadow-retro-sm",
        TONES[tone],
        SIZES[size],
        // A matched ball gets a ring rather than a different fill, so the tier
        // colour stays readable underneath.
        matched && "ring-4 ring-mustard ring-offset-2 ring-offset-paper",
        className,
      )}
    >
      {value}
    </span>
  );
}

/** A row of draw numbers. */
export function NumberRow({
  numbers,
  matchedNumbers = [],
  tone,
  size,
  className,
}: {
  numbers: number[];
  matchedNumbers?: number[];
  tone?: Tone;
  size?: Size;
  className?: string;
}) {
  // Copy before mutating: matching consumes entries so a number drawn once
  // cannot light up two identical balls (scores repeat — see decision D1).
  const remaining = [...matchedNumbers];

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {numbers.map((value, index) => {
        const matchIndex = remaining.indexOf(value);
        const isMatched = matchIndex !== -1;

        if (isMatched) remaining.splice(matchIndex, 1);

        return (
          <NumberBall
            key={`${value}-${index}`}
            value={value}
            tone={tone}
            size={size}
            matched={isMatched}
          />
        );
      })}
    </div>
  );
}

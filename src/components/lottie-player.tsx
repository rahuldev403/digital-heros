"use client";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

/**
 * Lottie player.
 *
 * Uses `LottieLight` rather than the full `Lottie`. The engine ships in three
 * sizes and each drops features the animation does not use; our file
 * (`golfer-cart.lottie.json`) is shape layers only — no expressions, no
 * effects, no text, no bitmaps — so the smallest build renders it identically
 * while shipping the least JavaScript.
 *
 * Loaded through `next/dynamic` with `ssr: false` so neither the engine nor the
 * animation enters the server render or the initial payload: a decorative
 * animation should never be on the critical path. The wrapper reserves its
 * aspect ratio up front, so nothing shifts when it does arrive — layout shift
 * being the usual cost of dropping a Lottie into a hero.
 */
const LottieLight = dynamic(
  () => import("lottie-react").then((mod) => mod.LottieLight),
  { ssr: false },
);

interface LottiePlayerProps {
  /** Path under /public, or any URL. The library fetches it. */
  src: string;
  className?: string;
  loop?: boolean;
  /** Intrinsic ratio of the source file, used to reserve space. */
  aspectRatio?: string;
}

export function LottiePlayer({
  src,
  className,
  loop = true,
  aspectRatio = "692 / 538",
}: LottiePlayerProps) {
  return (
    <div
      className={cn("w-full", className)}
      style={{ aspectRatio }}
      // Decorative: it restates what the adjacent headline already says, so
      // announcing it would only add noise for screen-reader users.
      aria-hidden="true"
    >
      <LottieLight src={src} autoplay loop={loop} className="size-full" />
    </div>
  );
}

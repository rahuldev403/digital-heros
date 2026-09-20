"use client";

import { useEffect, useRef, useState } from "react";

import dynamic from "next/dynamic";

import { cn } from "@/lib/utils";

/**
 * Lottie player.
 *
 * Two deliberate loads, both deferred:
 *
 *  1. The renderer (`lottie-react` wraps lottie-web, ~250 KB) is imported with
 *     `ssr: false` so it never enters the server bundle or the initial payload.
 *  2. The animation JSON (~128 KB) is fetched only once the element is near the
 *     viewport, via IntersectionObserver.
 *
 * Together that keeps a decorative animation off the critical path entirely —
 * the page is readable and interactive before either arrives. Until then a
 * reserved box holds the space, so nothing shifts when it does (no layout
 * shift, which is the usual cost of dropping a Lottie into a hero).
 */

const Lottie = dynamic(() => import("lottie-react"), {
  ssr: false,
});

interface LottiePlayerProps {
  /** Path under /public, e.g. "/golfer-cart.lottie.json". */
  src: string;
  className?: string;
  loop?: boolean;
  /** Intrinsic ratio, used to reserve space before the JSON loads. */
  aspectRatio?: string;
}

export function LottiePlayer({
  src,
  className,
  loop = true,
  aspectRatio = "692 / 538",
}: LottiePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [animationData, setAnimationData] = useState<unknown>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  // Start fetching slightly before the element scrolls into view, so the
  // animation is ready by the time it is actually looked at.
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    // Older browsers without IntersectionObserver simply load immediately.
    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad || animationData) return;

    let cancelled = false;

    fetch(src)
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        // The component may have unmounted while the fetch was in flight.
        if (!cancelled) setAnimationData(data);
      })
      .catch(() => {
        // A decorative animation failing is not worth breaking the page for;
        // the reserved box just stays empty.
      });

    return () => {
      cancelled = true;
    };
  }, [shouldLoad, src, animationData]);

  return (
    <div
      ref={containerRef}
      className={cn("w-full", className)}
      style={{ aspectRatio }}
      // Purely decorative: it repeats information the headline already gives,
      // so screen readers should skip it rather than announce "animation".
      aria-hidden="true"
    >
      {animationData ? (
        <Lottie
          animationData={animationData}
          loop={loop}
          autoplay
          className="size-full"
          rendererSettings={{ preserveAspectRatio: "xMidYMid meet" }}
        />
      ) : null}
    </div>
  );
}

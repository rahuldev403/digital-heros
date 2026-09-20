"use client";

import type { ReactNode } from "react";

import { motion } from "motion/react";

/**
 * Scroll-triggered entrance.
 *
 * `whileInView` with `once` means each element animates a single time, the
 * first time it is reached. Re-animating on every scroll past is the thing that
 * turns "motion-enhanced" (PRD §12) into motion sickness.
 *
 * The travel distance is small on purpose — 16px and a fade. Big slide-ins
 * fight the reader; this just marks that something new has arrived.
 *
 * Framer Motion reads `prefers-reduced-motion` itself and flattens these to an
 * instant state change when the OS asks for less motion.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * Staggers a set of children by index.
 *
 * Used for card grids, where a simultaneous fade-in of six cards reads as a
 * page-load flash rather than as content arriving.
 */
export function RevealGroup({
  children,
  className,
  step = 0.08,
}: {
  children: ReactNode[];
  className?: string;
  step?: number;
}) {
  return (
    <div className={className}>
      {children.map((child, index) => (
        <Reveal key={index} delay={index * step}>
          {child}
        </Reveal>
      ))}
    </div>
  );
}

"use client";

import { AlertCircle } from "lucide-react";
import { motion } from "motion/react";

import type { AuthActionState } from "@/lib/validation/auth";

/**
 * Form-level error banner.
 *
 * `role="alert"` makes a screen reader announce the message the moment it
 * appears — without it, a sighted user sees a red box while everyone else is
 * left wondering why nothing happened after pressing submit.
 */
export function FormStatus({ state }: { state: AuthActionState }) {
  if (state.status !== "error") return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      role="alert"
      className="flex items-start gap-2.5 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </motion.div>
  );
}

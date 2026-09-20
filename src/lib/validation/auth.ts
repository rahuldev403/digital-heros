import { z } from "zod";

import { CHARITY_MAX_PERCENT, CHARITY_MIN_PERCENT } from "../constants";

/**
 * Auth input schemas.
 *
 * Shared by the server actions and (for field-level hints) the forms. Server
 * actions re-validate with these regardless of what the client did — form
 * validation is a convenience for honest users, not a security boundary.
 */

/**
 * Emails are lowercased and trimmed at the edge so that the value stored, the
 * value looked up and the value in the unique index can never disagree.
 */
export const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required")
  .max(255, "That email is too long")
  .email("Enter a valid email address")
  .toLowerCase();

/**
 * Password policy: length over composition rules.
 *
 * A 10-character minimum with no forced symbol classes produces stronger real
 * passwords than an 8-character minimum with mandatory punctuation, which
 * mostly produces "Password1!". The upper bound exists because bcrypt silently
 * truncates at 72 bytes — without it, two different long passwords could both
 * unlock the same account.
 */
export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(72, "Use at most 72 characters");

export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Enter your name")
    .max(120, "That name is too long"),
  email: emailSchema,
  password: passwordSchema,
  /** Chosen at signup (PRD §08.1). Optional here; enforced by the signup flow. */
  charityId: z.string().uuid("Choose a charity").optional(),
  charityPercent: z.coerce
    .number()
    .int("Use a whole percentage")
    .min(CHARITY_MIN_PERCENT, `Minimum contribution is ${CHARITY_MIN_PERCENT}%`)
    .max(CHARITY_MAX_PERCENT, `Maximum contribution is ${CHARITY_MAX_PERCENT}%`)
    .default(CHARITY_MIN_PERCENT),
});

export type SignUpInput = z.infer<typeof signUpSchema>;

export const signInSchema = z.object({
  email: emailSchema,
  // Deliberately not `passwordSchema`: an existing account may predate a policy
  // change, and rejecting their real password as "too short" before even
  // checking it would lock them out of their own account.
  password: z.string().min(1, "Enter your password"),
});

export type SignInInput = z.infer<typeof signInSchema>;

/**
 * Shape returned by every auth server action.
 *
 * A discriminated union rather than throwing: form errors are an expected
 * outcome, not an exception, and this lets the form render per-field messages
 * without a try/catch around a transition.
 */
export type AuthActionState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success" };

/** Flattens a ZodError into the field-error shape the forms expect. */
export function toFieldErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (fieldErrors[key] ??= []).push(issue.message);
  }

  return fieldErrors;
}

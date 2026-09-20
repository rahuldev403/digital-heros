"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import type { AuthActionState } from "@/lib/validation/auth";

import { signInAction } from "../actions";
import { FormStatus } from "./form-status";

/**
 * Sign-in form.
 *
 * `useActionState` keeps the server action as the single source of truth for
 * validation: the same schema runs whether or not the client has JavaScript,
 * and the form still submits if it does not — the action is wired through the
 * form's `action`, so this degrades to a plain HTML POST.
 */
export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, isPending] = useActionState<AuthActionState, FormData>(
    signInAction,
    { status: "idle" },
  );

  const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next && <input type="hidden" name="next" value={next} />}

      <FormStatus state={state} />

      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
        errors={fieldErrors?.email}
      />

      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••"
        required
        errors={fieldErrors?.password}
      />

      <Button type="submit" size="lg" fullWidth loading={isPending}>
        {isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

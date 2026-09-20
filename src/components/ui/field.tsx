"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Labelled form field with inline validation messaging.
 *
 * The label, the input, the hint and the error are wired together with
 * generated ids so that `aria-describedby` and `aria-invalid` are always
 * correct. A screen-reader user hears the error attached to the field rather
 * than finding stray red text elsewhere on the page.
 */

interface FieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id"> {
  label: string;
  /** Messages from the server action, keyed by field name. */
  errors?: string[];
  hint?: ReactNode;
  /** Optional element rendered inside the field's right edge. */
  trailing?: ReactNode;
}

export function Field({
  label,
  errors,
  hint,
  trailing,
  className,
  required,
  ...props
}: FieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  const hasError = Boolean(errors?.length);

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="ml-1 text-ember" aria-hidden>
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={id}
          required={required}
          aria-invalid={hasError || undefined}
          aria-describedby={
            [hasError ? errorId : null, hint ? hintId : null]
              .filter(Boolean)
              .join(" ") || undefined
          }
          className={cn(
            "w-full h-11 px-3.5 rounded-xl",
            "bg-surface border text-ink placeholder:text-faint",
            "transition-colors duration-200",
            "focus:outline-none focus-visible:outline-none",
            hasError
              ? "border-danger/60 focus:border-danger"
              : "border-line focus:border-mint/60",
            // The ring is drawn with box-shadow so it does not shift layout.
            "focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--color-mint)_20%,transparent)]",
            trailing && "pr-12",
            className,
          )}
          {...props}
        />

        {trailing && (
          <div className="absolute inset-y-0 right-3 flex items-center text-muted">
            {trailing}
          </div>
        )}
      </div>

      {hasError ? (
        <p id={errorId} className="text-sm text-danger">
          {errors!.join(". ")}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

"use client";

import { useId, type ComponentPropsWithoutRef, type ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Labelled input with inline validation.
 *
 * Label, input, hint and error are wired together with generated ids so
 * `aria-describedby` and `aria-invalid` are always correct — a screen-reader
 * user hears the error attached to the field instead of finding orphaned red
 * text somewhere on the page.
 *
 * The inset shadow on focus is the same offset-print idea as the buttons,
 * pointing inward: the field looks stamped into the paper while you type.
 */

interface FieldProps extends Omit<ComponentPropsWithoutRef<"input">, "id"> {
  label: string;
  errors?: string[];
  hint?: ReactNode;
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
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
      >
        {label}
        {required && (
          <span className="ml-1 text-orange" aria-hidden>
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
            "w-full h-12 px-3.5 rounded-xl border-2 bg-paper text-ink",
            "placeholder:text-ink-faint",
            "transition-[box-shadow,border-color] duration-150",
            "focus:outline-none",
            hasError
              ? "border-danger focus:shadow-[inset_3px_3px_0_0_var(--color-danger)]"
              : "border-ink focus:shadow-[inset_3px_3px_0_0_var(--color-teal)]",
            trailing && "pr-12",
            className,
          )}
          {...props}
        />

        {trailing && (
          <div className="absolute inset-y-0 right-3 flex items-center text-ink-faint">
            {trailing}
          </div>
        )}
      </div>

      {hasError ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {errors!.join(". ")}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

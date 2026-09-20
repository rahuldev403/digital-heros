import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Button.
 *
 * Renders a `<button>` by default, or any element via `as` — a link that looks
 * like a button should still be an `<a>`, so it opens in a new tab on
 * middle-click and is announced correctly by screen readers.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-mint text-mint-ink hover:bg-mint-bright active:bg-mint " +
    "shadow-[0_1px_0_0_rgba(255,255,255,0.12)_inset]",
  secondary:
    "bg-elevated text-ink border border-line-strong hover:border-mint/50 hover:bg-line",
  ghost: "text-muted hover:text-ink hover:bg-elevated",
  danger: "bg-danger/15 text-danger border border-danger/30 hover:bg-danger/25",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-xl gap-2.5",
};

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks interaction. */
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}

type ButtonProps<T extends ElementType> = ButtonOwnProps & {
  as?: T;
} & Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | "as">;

export function Button<T extends ElementType = "button">({
  as,
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  ...props
}: ButtonProps<T>) {
  const Component = (as ?? "button") as ElementType;

  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center font-medium",
        "transition-[background-color,border-color,color,transform] duration-200",
        "active:scale-[0.98]",
        "disabled:pointer-events-none disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      // Only a real <button> understands `disabled`.
      {...(Component === "button" ? { disabled: loading || props.disabled } : {})}
      // Tells assistive technology the control is busy rather than broken.
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Component>
  );
}

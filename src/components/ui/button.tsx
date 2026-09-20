import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Button.
 *
 * The retro treatment is a thick ink keyline plus a hard offset shadow. On
 * press the button translates into its own shadow, so the click reads as a
 * physical stamp rather than a colour change — that one interaction carries
 * most of the "motion-enhanced, micro-interaction" requirement (PRD §12)
 * without any JavaScript.
 *
 * Renders as `<button>` by default, or any element via `as` — a link that looks
 * like a button must still be an `<a>` so it middle-clicks, right-clicks and
 * announces correctly.
 */

type Variant = "primary" | "secondary" | "dark" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-orange text-cream border-ink hover:bg-orange-deep",
  secondary: "bg-paper text-ink border-ink hover:bg-mustard",
  dark: "bg-ink text-cream border-ink hover:bg-forest",
  ghost: "bg-transparent text-ink border-transparent shadow-none hover:bg-cream-deep",
  danger: "bg-danger text-cream border-ink hover:brightness-110",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-lg gap-1.5",
  md: "h-11 px-5 text-sm rounded-xl gap-2",
  lg: "h-13 px-7 text-base rounded-xl gap-2.5",
};

interface ButtonOwnProps {
  variant?: Variant;
  size?: Size;
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
  const isGhost = variant === "ghost";

  return (
    <Component
      className={cn(
        "inline-flex items-center justify-center border-2 font-semibold uppercase tracking-wide",
        "transition-[transform,box-shadow,background-color] duration-150",
        // Press into the shadow.
        !isGhost && "shadow-retro-sm hover:-translate-y-0.5 hover:shadow-retro",
        !isGhost && "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        "disabled:pointer-events-none disabled:opacity-55",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...(Component === "button" ? { disabled: loading || props.disabled } : {})}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Component>
  );
}

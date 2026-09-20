import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names, with later Tailwind utilities winning over earlier ones.
 *
 * `clsx` handles conditionals and arrays; `twMerge` resolves genuine conflicts,
 * so a component's default `px-4` is replaced by a caller's `px-6` rather than
 * both landing in the class list and leaving the outcome to CSS source order.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

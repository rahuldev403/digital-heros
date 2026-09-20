"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Section navigation, rendered as inline pills inside the content column.
 *
 * Deliberately NOT a second full-width bar under the site header. Two stacked
 * bars read as two headers, and the duplication was worse than cosmetic: the
 * site header's "Draws" links to public results while this one links to the
 * player's own history, so the same word pointed at two different pages. These
 * labels are possessive ("My draws") to keep that distinction obvious.
 *
 * A client component because it needs the current path to mark the active tab —
 * which the previous bar did not do at all, leaving no indication of where you
 * were.
 */

export interface SectionTab {
  href: string;
  label: string;
}

export function SectionTabs({
  tabs,
  tone = "orange",
}: {
  tabs: SectionTab[];
  /** Active-pill colour; admin uses plum to stay visually distinct. */
  tone?: "orange" | "plum";
}) {
  const pathname = usePathname();

  const activeTone = tone === "plum" ? "bg-plum text-cream" : "bg-orange text-cream";

  return (
    <nav aria-label="Section">
      <ul className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          // Exact match for the section root, prefix match for its children —
          // otherwise "/dashboard" would light up on every nested page.
          const isActive =
            pathname === tab.href ||
            (tab.href !== tabs[0].href && pathname.startsWith(`${tab.href}/`));

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-block rounded-full border-2 border-ink px-4 py-1.5",
                  "text-xs font-bold uppercase tracking-widest",
                  "transition-[transform,box-shadow,background-color] duration-150",
                  isActive
                    ? `${activeTone} shadow-retro-sm`
                    : "bg-paper text-ink-soft hover:-translate-y-0.5 hover:bg-cream-deep hover:text-ink",
                )}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

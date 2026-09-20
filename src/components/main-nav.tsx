"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Primary public navigation.
 *
 * Split out of `SiteHeader` as a client component purely so it can read the
 * current path and mark the active link — the header itself stays a server
 * component, because it resolves the signed-in user and must not ship that
 * lookup to the browser.
 *
 * The active marker is an underline rather than a filled pill: the section tabs
 * inside the dashboard already use filled pills, and reusing that treatment
 * here would make a top-level destination look like a sub-section.
 */

const LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/charities", label: "Charities" },
  { href: "/draws", label: "Draws" },
];

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="hidden sm:block">
      <ul className="flex items-center gap-1">
        {LINKS.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);

          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative inline-block px-3 py-2 text-xs font-bold uppercase tracking-widest",
                  "transition-colors duration-150",
                  isActive ? "text-ink" : "text-ink-soft hover:text-ink",
                )}
              >
                {link.label}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute inset-x-3 -bottom-0.5 h-[3px] rounded-full bg-orange"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Compact nav for narrow screens.
 *
 * The desktop nav is hidden below `sm` because four links plus auth actions do
 * not fit; this renders the same destinations as a scrollable strip under the
 * wordmark instead of hiding them behind a menu button, since there are few
 * enough that a drawer would be more work than it saves.
 */
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Main"
      className="-mx-5 flex gap-1 overflow-x-auto border-t-2 border-ink/10 px-5 pt-2 sm:hidden"
    >
      {LINKS.map((link) => {
        const isActive =
          pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-full border-2 border-ink px-3 py-1 text-[0.65rem] font-bold uppercase tracking-widest",
              isActive ? "bg-orange text-cream" : "bg-paper text-ink-soft",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

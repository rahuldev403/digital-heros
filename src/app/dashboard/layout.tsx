import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-header";

/**
 * Dashboard shell.
 *
 * Note that this layout does NOT perform the auth check. Layouts do not
 * re-render on navigation between the routes they wrap, and do not control
 * whether child segments render — so a guard here would be both skippable and
 * stale. Each page calls `requireUser()` itself (decision D9).
 */

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scores", label: "Scores" },
  { href: "/dashboard/draws", label: "Draws" },
  { href: "/dashboard/charity", label: "Charity" },
];

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <SiteHeader />

      <div className="flex-1">
        <nav className="border-b-2 border-ink bg-cream-deep">
          <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-5">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className="inline-block whitespace-nowrap border-b-4 border-transparent px-4 py-3 text-sm font-bold uppercase tracking-widest text-ink-soft transition-colors hover:border-orange hover:text-ink"
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="mx-auto w-full max-w-5xl px-5 py-10">{children}</main>
      </div>

      <SiteFooter />
    </>
  );
}

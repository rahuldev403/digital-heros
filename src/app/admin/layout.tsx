import Link from "next/link";

import { SiteHeader } from "@/components/site-header";

/**
 * Admin shell.
 *
 * As with the dashboard, the guard is not here — each admin page calls
 * `requireAdmin()` itself, because a layout does not control whether its child
 * segments render (decision D9).
 */

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/draws", label: "Draws" },
  { href: "/admin/charities", label: "Charities" },
  { href: "/admin/winners", label: "Winners" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SiteHeader />

      <div className="flex-1">
        <div className="border-b-2 border-ink bg-ink text-cream">
          <div className="mx-auto max-w-6xl px-5 py-4">
            <p className="font-display text-sm uppercase tracking-widest text-mustard">
              Admin control
            </p>
          </div>
        </div>

        <nav className="border-b-2 border-ink bg-cream-deep">
          <ul className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5">
            {TABS.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  className="inline-block whitespace-nowrap border-b-4 border-transparent px-4 py-3 text-sm font-bold uppercase tracking-widest text-ink-soft transition-colors hover:border-plum hover:text-ink"
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="mx-auto w-full max-w-6xl px-5 py-10">{children}</main>
      </div>
    </>
  );
}

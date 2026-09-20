import { SectionTabs } from "@/components/section-tabs";
import { SiteHeader } from "@/components/site-header";

/**
 * Admin shell.
 *
 * Same single-bar rule as the dashboard: one sticky site header, with section
 * navigation as inline pills. The plum tone on the active pill is the only
 * signal that distinguishes admin from the member area, which is enough — the
 * routes are already separate and the header shows the Admin link.
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

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border-2 border-ink bg-ink px-3 py-1.5 text-xs font-bold uppercase tracking-widest text-mustard">
            Admin
          </span>
          <SectionTabs tabs={TABS} tone="plum" />
        </div>

        <div className="mt-8">{children}</div>
      </main>
    </>
  );
}

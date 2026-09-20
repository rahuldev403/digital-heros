import { SectionTabs } from "@/components/section-tabs";
import { SiteFooter, SiteHeader } from "@/components/site-header";

/**
 * Dashboard shell.
 *
 * One sticky bar only — the site header. Section navigation sits inline at the
 * top of the content column as pills, so the page does not present two stacked
 * navigation bars.
 *
 * Note that this layout does NOT perform the auth check. Layouts do not
 * re-render on navigation between the routes they wrap, and do not control
 * whether child segments render — so a guard here would be both skippable and
 * stale. Each page calls `requireUser()` itself (decision D9).
 */

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/scores", label: "My scores" },
  { href: "/dashboard/draws", label: "My draws" },
  { href: "/dashboard/charity", label: "My charity" },
];

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <>
      <SiteHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8">
        <SectionTabs tabs={TABS} />
        <div className="mt-8">{children}</div>
      </main>

      <SiteFooter />
    </>
  );
}

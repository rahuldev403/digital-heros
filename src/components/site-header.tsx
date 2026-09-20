import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { MainNav, MobileNav } from "@/components/main-nav";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";

/**
 * Site header.
 *
 * Resolves the current user itself rather than taking it as a prop, so any page
 * can render it without threading auth state through. `getCurrentUser` is
 * memoised per request, so a page that already called it pays nothing extra.
 *
 * Stays a server component for that reason; only the nav — which needs the
 * current path to mark the active link — is a client component.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-5 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="font-display text-xl uppercase tracking-tight"
            >
              digital<span className="text-orange">.</span>heroes
            </Link>

            <MainNav />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {user ? (
              <>
                <Button as={Link} href="/dashboard" size="sm">
                  Dashboard
                </Button>
                {user.role === "admin" && (
                  <Button as={Link} href="/admin" variant="dark" size="sm">
                    Admin
                  </Button>
                )}
                <form action={signOutAction} className="hidden sm:block">
                  <Button type="submit" variant="ghost" size="sm">
                    Sign out
                  </Button>
                </form>
              </>
            ) : (
              <>
                <Button
                  as={Link}
                  href="/login"
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                >
                  Sign in
                </Button>
                <Button as={Link} href="/signup" size="sm">
                  Join
                </Button>
              </>
            )}
          </div>
        </div>

        <MobileNav />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-cream px-5 py-10">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="space-y-1.5">
            <p className="font-display text-lg uppercase text-ink">
              digital<span className="text-orange">.</span>heroes
            </p>
            <p className="max-w-xs text-sm text-ink-soft">
              Golf performance, monthly draws, and a cause you choose.
            </p>
          </div>

          <div className="flex flex-wrap gap-12">
            <FooterColumn
              title="Platform"
              links={[
                { href: "/pricing", label: "Pricing" },
                { href: "/charities", label: "Charities" },
                { href: "/draws", label: "Draw results" },
              ]}
            />
            <FooterColumn
              title="Account"
              links={[
                { href: "/dashboard", label: "Dashboard" },
                { href: "/dashboard/scores", label: "Your scores" },
                { href: "/login", label: "Sign in" },
                { href: "/signup", label: "Create account" },
              ]}
            />
          </div>
        </div>

        <p className="border-t-2 border-dashed border-ink/15 pt-5 text-xs text-ink-faint">
          A golf performance and charity draw platform.
        </p>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string }[];
}) {
  return (
    <div className="space-y-2.5">
      <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
        {title}
      </p>
      <ul className="space-y-1.5 text-sm">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="text-ink-soft hover:text-ink">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

import Link from "next/link";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";

/**
 * Site header.
 *
 * Resolves the current user itself rather than taking it as a prop, so any page
 * can render it without threading auth state through. `getCurrentUser` is
 * memoised per request, so this costs nothing extra on a page that already
 * called it.
 */
export async function SiteHeader() {
  const user = await getCurrentUser();

  return (
    <header className="sticky top-0 z-50 border-b-2 border-ink bg-cream/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="font-display text-xl uppercase tracking-tight">
          digital<span className="text-orange">.</span>heroes
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          <Button as={Link} href="/charities" variant="ghost" size="sm">
            Charities
          </Button>
          <Button as={Link} href="/draws" variant="ghost" size="sm">
            Draws
          </Button>

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
              <Button as={Link} href="/login" variant="ghost" size="sm">
                Sign in
              </Button>
              <Button as={Link} href="/signup" size="sm">
                Join
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t-2 border-ink bg-cream px-5 py-8">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 text-sm text-ink-faint">
        <p className="font-display text-base uppercase text-ink">
          digital<span className="text-orange">.</span>heroes
        </p>
        <nav className="flex gap-5">
          <Link href="/charities" className="hover:text-ink">
            Charities
          </Link>
          <Link href="/draws" className="hover:text-ink">
            Draws
          </Link>
          <Link href="/pricing" className="hover:text-ink">
            Pricing
          </Link>
        </nav>
      </div>
    </footer>
  );
}

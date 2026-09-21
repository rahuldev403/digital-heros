import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";

/**
 * 404 — used for unknown URLs and for every `notFound()` call.
 *
 * That includes the deliberate ones: an admin route visited by a non-admin, a
 * claim page for a draw the visitor did not win, a proof file that is not
 * theirs. Those return 404 rather than 403 on purpose (decisions D9 and D14),
 * so this page must not hint that the thing exists — it reads the same whether
 * the URL was mistyped or refused.
 */
export default function NotFound() {
  return (
    <>
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-5 py-20">
        <div className="max-w-md space-y-6 text-center">
          <p className="font-mono text-7xl font-bold tabular text-orange">404</p>
          <h1 className="text-4xl">Out of bounds.</h1>
          <p className="text-lg text-ink-soft">
            That page is not here. It may have moved, or the link may be wrong.
          </p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button as={Link} href="/" size="lg">
              Back to the start
            </Button>
            <Button as={Link} href="/charities" size="lg" variant="secondary">
              Browse charities
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

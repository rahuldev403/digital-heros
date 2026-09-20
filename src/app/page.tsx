import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";

/**
 * Landing page — interim.
 *
 * Deliberately minimal for now. The full homepage the PRD asks for (§12
 * HOMEPAGE: what the user does, how they win, charity impact, and the call to
 * action) is built in Phase 9, once the systems it needs to describe actually
 * exist and it can show real figures instead of placeholders.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <div className="glow-mint pointer-events-none absolute inset-x-0 -top-32 h-128" />

      <div className="relative max-w-2xl space-y-8">
        <p className="text-sm font-medium tracking-[0.2em] text-mint uppercase">
          digital heroes
        </p>

        <h1 className="text-5xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
          The scores you played are
          <span className="block font-display italic text-mint">
            the numbers you play.
          </span>
        </h1>

        <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted text-balance">
          Log your last five rounds. They become your entry in the monthly draw —
          no tickets, no picking numbers. And at least a tenth of every
          subscription goes to a cause you choose.
        </p>

        <div className="flex flex-col items-center justify-center gap-3 pt-2 sm:flex-row">
          {user ? (
            <Button as={Link} href="/dashboard" size="lg">
              Go to your dashboard
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <>
              <Button as={Link} href="/signup" size="lg">
                Create an account
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button as={Link} href="/login" size="lg" variant="secondary">
                Sign in
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

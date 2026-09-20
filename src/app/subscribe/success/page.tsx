import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { PartyPopper } from "lucide-react";

import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/dal";
import { MIN_SCORES_FOR_ENTRY } from "@/lib/constants";
import { reconcileCheckoutSession } from "@/lib/services/billing";
import { listScores } from "@/lib/services/scores";
import { getSubscriptionState } from "@/lib/subscription";

export const metadata: Metadata = { title: "Welcome aboard" };

/**
 * Checkout return page.
 *
 * Reconciles the session server-side before rendering, so the user sees their
 * subscription as active immediately rather than waiting for the webhook to
 * land. The webhook still fires and is idempotent, so whichever arrives first
 * wins and the second is a no-op.
 */
export default async function SubscribeSuccessPage({
  searchParams,
}: PageProps<"/subscribe/success">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/dashboard");

  const params = await searchParams;
  const sessionId = typeof params.session_id === "string" ? params.session_id : null;

  let reconcileError: string | null = null;

  if (sessionId) {
    try {
      const result = await reconcileCheckoutSession(sessionId);
      if (!result.ok) reconcileError = result.error ?? null;
    } catch (error) {
      // A failure here is recoverable — the webhook will still arrive — so the
      // page reassures rather than alarming.
      reconcileError =
        error instanceof Error ? error.message : "Could not confirm immediately.";
    }
  }

  // Re-read after reconciling; `getCurrentUser` was memoised before the write.
  const subscription = await getSubscriptionState(user.id);
  const scores = await listScores(user.id);
  const missing = Math.max(0, MIN_SCORES_FOR_ENTRY - scores.length);

  return (
    <>
      <SiteHeader />

      <main className="flex-1 px-5 py-16">
        <div className="mx-auto max-w-xl space-y-8">
          <div className="space-y-4 text-center">
            <span className="inline-flex size-16 items-center justify-center rounded-full border-2 border-ink bg-mustard shadow-retro">
              <PartyPopper className="size-7" aria-hidden />
            </span>

            <h1 className="text-4xl sm:text-5xl">
              You&apos;re in,
              <br />
              <span className="text-orange">{user.fullName.split(" ")[0]}.</span>
            </h1>

            <p className="text-lg text-ink-soft">
              {subscription.hasAccess
                ? `Your ${subscription.planName} subscription is active.`
                : "Your payment went through. We're confirming it now."}
            </p>
          </div>

          {reconcileError && !subscription.hasAccess && (
            <p className="rounded-xl border-2 border-ink bg-mustard px-4 py-3 text-sm">
              Stripe is still confirming this payment. It usually takes a few
              seconds — refresh this page shortly.
            </p>
          )}

          <section className="card-retro space-y-4 p-6">
            <h2 className="text-xl">What happens next</h2>
            <ol className="space-y-3 text-sm">
              <Step
                n={1}
                done={missing === 0}
                text={
                  missing === 0
                    ? "You have five scores logged — you are entered in the next draw."
                    : `Log ${missing} more ${missing === 1 ? "round" : "rounds"} to be entered in the next draw.`
                }
              />
              <Step
                n={2}
                done={Boolean(user.charityId)}
                text={
                  user.charityName
                    ? `${user.charityPercent}% of every payment goes to ${user.charityName}.`
                    : "Choose the cause your contribution supports."
                }
              />
              <Step
                n={3}
                done={false}
                text="Results are published after each monthly draw."
              />
            </ol>
          </section>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button as={Link} href="/dashboard/scores" size="lg" fullWidth>
              {missing === 0 ? "Review your scores" : "Log a round"}
            </Button>
            <Button
              as={Link}
              href="/dashboard"
              size="lg"
              variant="secondary"
              fullWidth
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      </main>

      <SiteFooter />
    </>
  );
}

function Step({ n, done, text }: { n: number; done: boolean; text: string }) {
  return (
    <li className="flex gap-3">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-ink font-mono text-xs font-bold ${
          done ? "bg-forest text-cream" : "bg-cream-deep"
        }`}
      >
        {done ? "✓" : n}
      </span>
      <span className={done ? "text-ink-soft line-through" : ""}>{text}</span>
    </li>
  );
}

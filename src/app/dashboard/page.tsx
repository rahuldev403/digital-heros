import type { Metadata } from "next";
import Link from "next/link";

import { ShieldCheck } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/dal";
import { describeSubscription } from "@/lib/subscription";

export const metadata: Metadata = {
  title: "Dashboard · Digital Heroes",
};

/**
 * Dashboard placeholder.
 *
 * Phase 1 builds the auth spine, so this page exists to prove it end to end:
 * the route is guarded, the session resolves to a real user, and the
 * subscription state is read live on every request (PRD §04 VALIDATION). The
 * full dashboard — scores, draws, winnings, charity (PRD §10) — is Phase 7.
 */
export default async function DashboardPage() {
  const user = await requireUser("/dashboard");

  return (
    <div className="mx-auto max-w-3xl px-6 py-16 space-y-10">
      <header className="space-y-2">
        <p className="text-sm text-muted">Signed in as {user.email}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Hello, {user.fullName.split(" ")[0]}.
        </h1>
      </header>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Stat label="Subscription" value={describeSubscription(user.subscription)} />
        <Stat label="Plan" value={user.subscription.planName ?? "—"} />
        <Stat label="Supporting" value={user.charityName ?? "Not chosen yet"} />
        <Stat label="Contribution" value={`${user.charityPercent}% of each payment`} />
      </dl>

      {user.role === "admin" && (
        <Link
          href="/admin"
          className="flex items-center gap-3 rounded-xl border border-mint/30 bg-mint/5 px-4 py-3 text-sm text-mint transition-colors hover:bg-mint/10"
        >
          <ShieldCheck className="size-4" aria-hidden />
          You have administrator access
        </Link>
      )}

      <p className="text-sm text-faint">
        The full dashboard — scores, draw entries and winnings — arrives in a later
        phase. This page currently exists to verify authentication.
      </p>

      <form action={signOutAction}>
        <Button type="submit" variant="secondary" size="sm">
          Sign out
        </Button>
      </form>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-medium text-ink">{value}</dd>
    </div>
  );
}

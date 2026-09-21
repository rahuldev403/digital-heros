import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { and, asc, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";

import { StatusPill } from "@/components/ui/status-pill";
import { db } from "@/db";
import { charities, subscriptions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { listScores } from "@/lib/services/scores";
import { getSubscriptionState } from "@/lib/subscription";

import {
  CancelSubscriptionButton,
  ProfileForm,
  RevokeSessionsButton,
  ScoreEditor,
} from "./_components/user-admin-panels";

export const metadata: Metadata = { title: "Edit user" };

/**
 * User detail — PRD §11.01: edit the profile, edit golf scores, manage the
 * subscription.
 */
export default async function AdminUserPage({ params }: PageProps<"/admin/users/[id]">) {
  const admin = await requireAdmin();
  const { id } = await params;

  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) notFound();

  const [charityRows, scores, subscription, [activeSub]] = await Promise.all([
    db
      .select({ id: charities.id, name: charities.name, isActive: charities.isActive })
      .from(charities)
      .orderBy(asc(charities.name)),
    listScores(id),
    getSubscriptionState(id),
    db
      .select({
        stripeSubscriptionId: subscriptions.stripeSubscriptionId,
        cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, id), eq(subscriptions.status, "active")))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1),
  ]);

  return (
    <div className="space-y-8">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All users
      </Link>

      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">{user.fullName}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={user.status} />
          {user.role === "admin" && <StatusPill status="admin" className="bg-plum text-cream" />}
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <ProfileForm
            user={{
              id: user.id,
              fullName: user.fullName,
              email: user.email,
              role: user.role,
              status: user.status,
              charityId: user.charityId,
              charityPercent: user.charityPercent,
            }}
            charities={charityRows}
            isSelf={user.id === admin.id}
          />

          <ScoreEditor
            userId={user.id}
            scores={scores.map((s) => ({
              id: s.id,
              playedOn: s.playedOn,
              points: s.points,
              courseName: s.courseName,
            }))}
          />
        </div>

        <div className="space-y-6">
          <section className="card-retro space-y-4 p-6">
            <h2 className="text-xl">Subscription</h2>
            <StatusPill status={subscription.status} />
            <p className="text-sm text-ink-soft">{subscription.planName ?? "No plan"}</p>

            {activeSub && !activeSub.cancelAtPeriodEnd && (
              <CancelSubscriptionButton
                userId={user.id}
                isSeeded={activeSub.stripeSubscriptionId?.startsWith("sub_seed_") ?? true}
              />
            )}
          </section>

          <section className="card-retro space-y-3 p-6">
            <h2 className="text-xl">Access</h2>
            <RevokeSessionsButton userId={user.id} />
          </section>
        </div>
      </div>
    </div>
  );
}

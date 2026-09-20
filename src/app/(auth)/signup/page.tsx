import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { charities } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";

import { SignupForm } from "../_components/signup-form";

export const metadata: Metadata = {
  title: "Create your account · Digital Heroes",
  description:
    "Join Digital Heroes: log your rounds, enter the monthly draw and support a cause you choose.",
};

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  // Only active charities can be chosen. A deactivated charity stays in the
  // database for historical reporting but must not accept new supporters.
  const charityOptions = await db
    .select({
      id: charities.id,
      name: charities.name,
      category: charities.category,
    })
    .from(charities)
    .where(eq(charities.isActive, true))
    .orderBy(asc(charities.sortOrder), asc(charities.name));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Start playing for
          <span className="font-display italic text-mint"> something.</span>
        </h1>
        <p className="text-muted">
          Log your rounds, enter every monthly draw, and send part of your
          subscription to a cause you care about.
        </p>
      </header>

      <SignupForm charities={charityOptions} next={next} />

      <p className="text-sm text-muted">
        Already have an account?{" "}
        <Link
          href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
          className="font-medium text-mint underline-offset-4 hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

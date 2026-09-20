import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/dal";

import { LoginForm } from "../_components/login-form";

export const metadata: Metadata = {
  title: "Sign in · Digital Heroes",
  description: "Sign in to log your scores, follow the draw and track your giving.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  // Someone already signed in has no business on the sign-in page.
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back.</h1>
        <p className="text-muted">
          Sign in to log your scores and follow this month&apos;s draw.
        </p>
      </header>

      <LoginForm next={next} />

      <p className="text-sm text-muted">
        New here?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-medium text-mint underline-offset-4 hover:underline"
        >
          Create an account
        </Link>
      </p>
    </div>
  );
}

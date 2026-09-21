"use client";

import { useEffect } from "react";

import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * Error boundary for every route below the root layout.
 *
 * Never shows `error.message` to the visitor. In production Next.js already
 * replaces Server Component errors with a generic message, but a Client
 * Component error arrives unredacted and could carry a query fragment or an
 * internal detail. The `digest` is shown instead: it identifies the matching
 * entry in the server logs without revealing anything.
 *
 * Next.js 16 passes `retry` (earlier versions called it `reset`).
 */
export default function RouteError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // Surfaces in the browser console and in Vercel's function logs.
    console.error(error);
  }, [error]);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-20">
      <div className="max-w-md space-y-6 text-center">
        <p className="font-mono text-6xl font-bold text-orange">Oops.</p>
        <h1 className="text-4xl">Something went wrong.</h1>
        <p className="text-lg text-ink-soft">
          That did not load. It is usually temporary — try again, and if it keeps
          happening, the reference below helps us find it.
        </p>

        {error.digest && (
          <p className="font-mono text-xs text-ink-faint">ref {error.digest}</p>
        )}

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button type="button" size="lg" onClick={() => retry()}>
            Try again
          </Button>
          <Button as={Link} href="/" size="lg" variant="secondary">
            Home
          </Button>
        </div>
      </div>
    </main>
  );
}

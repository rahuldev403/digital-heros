import type { Metadata } from "next";
import Link from "next/link";

import { ArrowLeft } from "lucide-react";

import { requireAdmin } from "@/lib/dal";

import { CharityForm } from "../_components/charity-form";

export const metadata: Metadata = { title: "New charity" };

export default async function NewCharityPage() {
  await requireAdmin();

  return (
    <div className="space-y-8">
      <Link
        href="/admin/charities"
        className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-ink-soft hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All charities
      </Link>

      <header className="space-y-2">
        <h1 className="text-4xl sm:text-5xl">New charity</h1>
        <p className="text-ink-soft">
          Members will choose this cause at signup and direct part of every
          payment to it.
        </p>
      </header>

      <CharityForm />
    </div>
  );
}

"use client";

import { useActionState, useState } from "react";

import { CheckCircle2, Upload } from "lucide-react";
import { motion } from "motion/react";

import { Button } from "@/components/ui/button";
import {
  ACCEPT_ATTRIBUTE,
  ACCEPTED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/image-validation";

import { submitClaimAction, type ClaimState } from "../actions";

/**
 * Proof upload form.
 *
 * Client-side size and type checks here are a courtesy — they save a failed
 * round trip and give instant feedback. The server re-validates everything from
 * the file's own bytes, because nothing arriving from a browser is trustworthy.
 */
export function ClaimForm({ periodKey }: { periodKey: string }) {
  const [state, action, isPending] = useActionState<ClaimState, FormData>(
    submitClaimAction,
    { status: "idle" },
  );

  const [fileName, setFileName] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      setFileName(null);
      setLocalError(null);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      setLocalError(`That file is larger than ${limitMb}MB.`);
      setFileName(null);
      event.target.value = "";
      return;
    }

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof ACCEPTED_IMAGE_TYPES)[number])) {
      setLocalError("Upload a PNG, JPEG or WebP image.");
      setFileName(null);
      event.target.value = "";
      return;
    }

    setLocalError(null);
    setFileName(file.name);
  }

  if (state.status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        role="status"
        className="card-retro space-y-3 bg-forest p-6 text-cream"
      >
        <CheckCircle2 className="size-8" aria-hidden />
        <h2 className="text-2xl">Submitted</h2>
        <p className="text-cream/85">{state.message}</p>
      </motion.div>
    );
  }

  return (
    <form action={action} className="card-retro space-y-5 p-6">
      <input type="hidden" name="periodKey" value={periodKey} />

      {(state.status === "error" || localError) && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ink bg-danger px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          {localError ?? (state.status === "error" ? state.message : "")}
        </p>
      )}

      <div className="space-y-2">
        <label
          htmlFor="proof"
          className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
        >
          Screenshot of your scores
        </label>

        <label
          htmlFor="proof"
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-ink/40 bg-cream-deep px-5 py-10 text-center transition-colors hover:border-ink hover:bg-cream"
        >
          <Upload className="size-7 text-ink-soft" aria-hidden />
          <span className="font-semibold">
            {fileName ?? "Choose an image"}
          </span>
          <span className="text-sm text-ink-faint">
            PNG, JPEG or WebP · up to {limitMb}MB
          </span>
        </label>

        <input
          id="proof"
          name="proof"
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          required
          onChange={handleFileChange}
          className="sr-only"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="note"
          className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
        >
          Anything to add (optional)
        </label>
        <textarea
          id="note"
          name="note"
          rows={3}
          maxLength={500}
          placeholder="e.g. the round on the 14th was at a different club"
          className="w-full rounded-xl border-2 border-ink bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] focus:outline-none"
        />
      </div>

      <Button type="submit" size="lg" loading={isPending} disabled={!fileName}>
        {isPending ? "Uploading…" : "Submit proof"}
      </Button>

      <p className="text-xs text-ink-faint">
        Only you and an administrator can view what you upload. It is stored
        privately and served through an access-controlled link — there is no
        public URL.
      </p>
    </form>
  );
}

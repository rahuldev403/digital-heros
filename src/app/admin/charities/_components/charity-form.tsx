"use client";

import { useActionState, useState } from "react";

import { CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { slugify } from "@/lib/validation/charity";

import {
  createCharityAction,
  updateCharityAction,
  type CharityAdminState,
} from "../actions";

export interface CharityFormValues {
  id?: string;
  name: string;
  slug: string;
  tagline: string | null;
  summary: string;
  description: string;
  category: string;
  location: string | null;
  websiteUrl: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  isFeatured: boolean;
  isActive: boolean;
  sortOrder: number;
}

/**
 * Charity create/edit form — PRD §11.03.
 *
 * One component for both operations: the fields, validation and layout are
 * identical, and keeping two copies in step by hand is how an edit form ends up
 * quietly missing a field that create has.
 */
export function CharityForm({ charity }: { charity?: CharityFormValues }) {
  const isEdit = Boolean(charity?.id);

  const [state, action, isPending] = useActionState<CharityAdminState, FormData>(
    isEdit ? updateCharityAction : createCharityAction,
    { status: "idle" },
  );

  const [name, setName] = useState(charity?.name ?? "");
  const [slug, setSlug] = useState(charity?.slug ?? "");
  // Once a charity is public, its slug is a live URL, so it is not auto-updated
  // from the name on edit — only suggested while creating.
  const [slugTouched, setSlugTouched] = useState(isEdit);

  const errors = state.status === "error" ? state.fieldErrors : undefined;

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  return (
    <form action={action} className="space-y-6">
      {isEdit && <input type="hidden" name="charityId" value={charity!.id} />}

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-xl border-2 border-ink bg-danger px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border-2 border-ink bg-forest px-3.5 py-2.5 text-sm font-medium text-cream"
        >
          <CheckCircle2 className="size-4 shrink-0" aria-hidden />
          {state.message}
        </p>
      )}

      <section className="card-retro space-y-5 p-6">
        <h2 className="text-xl">Identity</h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Name"
            name="name"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            errors={errors?.name}
          />
          <Field
            label="Slug"
            name="slug"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            hint={`Public URL: /charities/${slug || "…"}`}
            errors={errors?.slug}
          />
        </div>

        <Field
          label="Tagline"
          name="tagline"
          defaultValue={charity?.tagline ?? ""}
          placeholder="One line that makes someone care"
          errors={errors?.tagline}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Category"
            name="category"
            required
            defaultValue={charity?.category ?? ""}
            placeholder="Youth, Health, Education…"
            errors={errors?.category}
          />
          <Field
            label="Location"
            name="location"
            defaultValue={charity?.location ?? ""}
            errors={errors?.location}
          />
        </div>

        <Field
          label="Website"
          name="websiteUrl"
          type="url"
          defaultValue={charity?.websiteUrl ?? ""}
          placeholder="https://…"
          errors={errors?.websiteUrl}
        />
      </section>

      <section className="card-retro space-y-5 p-6">
        <h2 className="text-xl">Story</h2>

        <TextArea
          label="Summary"
          name="summary"
          rows={3}
          required
          defaultValue={charity?.summary ?? ""}
          hint="Shown on directory cards. Two sentences."
          errors={errors?.summary}
        />

        <TextArea
          label="Description"
          name="description"
          rows={8}
          required
          defaultValue={charity?.description ?? ""}
          hint="The profile page. Say what the money actually pays for."
          errors={errors?.description}
        />
      </section>

      <section className="card-retro space-y-5 p-6">
        <h2 className="text-xl">Media</h2>
        <p className="text-sm text-ink-soft">
          PNG, JPEG or WebP, up to 2MB each. Leave blank to keep the current image.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <ImageField label="Logo" name="logo" currentUrl={charity?.logoUrl} />
          <ImageField label="Cover image" name="cover" currentUrl={charity?.coverImageUrl} />
        </div>
      </section>

      <section className="card-retro space-y-4 p-6">
        <h2 className="text-xl">Visibility</h2>

        <Checkbox
          name="isActive"
          label="Listed and selectable"
          hint="Unlisted charities keep their history but accept no new supporters."
          defaultChecked={charity?.isActive ?? true}
        />

        <Checkbox
          name="isFeatured"
          label="Homepage spotlight"
          hint="Featured in the spotlight section on the homepage."
          defaultChecked={charity?.isFeatured ?? false}
        />

        <Field
          label="Sort order"
          name="sortOrder"
          type="number"
          min={0}
          defaultValue={String(charity?.sortOrder ?? 0)}
          hint="Lower numbers appear first."
          errors={errors?.sortOrder}
        />
      </section>

      <Button type="submit" size="lg" loading={isPending}>
        {isPending ? "Saving…" : isEdit ? "Save changes" : "Create charity"}
      </Button>
    </form>
  );
}

function TextArea({
  label,
  name,
  rows,
  required,
  defaultValue,
  hint,
  errors,
}: {
  label: string;
  name: string;
  rows: number;
  required?: boolean;
  defaultValue?: string;
  hint?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={name}
        className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
      >
        {label}
        {required && <span className="ml-1 text-orange">*</span>}
      </label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        required={required}
        defaultValue={defaultValue}
        aria-invalid={errors?.length ? true : undefined}
        className={`w-full rounded-xl border-2 bg-paper px-3.5 py-2.5 text-ink placeholder:text-ink-faint focus:outline-none focus:shadow-[inset_3px_3px_0_0_var(--color-teal)] ${
          errors?.length ? "border-danger" : "border-ink"
        }`}
      />
      {errors?.length ? (
        <p className="text-sm font-medium text-danger">{errors.join(". ")}</p>
      ) : hint ? (
        <p className="text-sm text-ink-faint">{hint}</p>
      ) : null}
    </div>
  );
}

function ImageField({
  label,
  name,
  currentUrl,
}: {
  label: string;
  name: string;
  currentUrl?: string | null;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      <label
        htmlFor={name}
        className="block text-xs font-bold uppercase tracking-widest text-ink-soft"
      >
        {label}
      </label>

      {(preview ?? currentUrl) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview ?? currentUrl ?? ""}
          alt=""
          className="h-28 w-full rounded-xl border-2 border-ink bg-cream-deep object-contain"
        />
      )}

      <input
        id={name}
        name={name}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Object URL rather than a FileReader data URL: no base64 blow-up and
          // it is released automatically when the page unloads.
          setPreview(file ? URL.createObjectURL(file) : null);
        }}
        className="block w-full text-sm file:mr-3 file:rounded-lg file:border-2 file:border-ink file:bg-paper file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:tracking-widest"
      />
    </div>
  );
}

function Checkbox({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer gap-3">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 size-5 shrink-0 accent-orange"
      />
      <span>
        <span className="block font-semibold">{label}</span>
        <span className="block text-sm text-ink-soft">{hint}</span>
      </span>
    </label>
  );
}

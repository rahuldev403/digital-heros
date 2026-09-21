"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { auditLogs, charities, charityEvents, donations, payments, uploads, users } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import { MAX_CHARITY_IMAGE_BYTES, validateImageUpload } from "@/lib/image-validation";
import { charityEventSchema, charitySchema } from "@/lib/validation/charity";
import { toFieldErrors } from "@/lib/validation/auth";

/**
 * Charity management — PRD §11.03: add, edit, delete charities and manage
 * content and media.
 */

export type CharityAdminState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message: string };

function refresh(slug?: string) {
  revalidatePath("/admin/charities");
  revalidatePath("/charities");
  revalidatePath("/");
  if (slug) revalidatePath(`/charities/${slug}`);
}

async function audit(
  admin: { id: string; email: string },
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    actorId: admin.id,
    actorEmail: admin.email,
    action,
    entityType: "charity",
    entityId,
    metadata,
  });
}

/** Parses the shared charity form fields out of FormData. */
function readCharityForm(formData: FormData) {
  return charitySchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    tagline: formData.get("tagline") || undefined,
    summary: formData.get("summary"),
    description: formData.get("description"),
    category: formData.get("category"),
    location: formData.get("location") || undefined,
    websiteUrl: formData.get("websiteUrl") || undefined,
    // Unchecked checkboxes are absent from FormData entirely, so their absence
    // is the "false" signal — `Boolean(null)` would be wrong for "on".
    isFeatured: formData.get("isFeatured") === "on",
    isActive: formData.get("isActive") === "on",
    sortOrder: formData.get("sortOrder") ?? 0,
  });
}

/**
 * Stores an uploaded image and returns its served URL.
 *
 * Marked public: charity logos appear on pages anyone can view. Winner proof
 * uploads deliberately go through a different call that leaves `isPublic`
 * false.
 */
async function storePublicImage(
  file: FormDataEntryValue | null,
  adminId: string,
): Promise<{ url: string } | { error: string } | null> {
  if (!(file instanceof File) || file.size === 0) return null;

  const validated = await validateImageUpload(file, MAX_CHARITY_IMAGE_BYTES);
  if (!validated.ok) return { error: validated.error };

  const [row] = await db
    .insert(uploads)
    .values({
      data: validated.bytes,
      mimeType: validated.mimeType,
      fileName: file.name,
      sizeBytes: validated.bytes.length,
      isPublic: true,
      uploadedBy: adminId,
    })
    .returning({ id: uploads.id });

  return { url: `/api/uploads/${row.id}` };
}

// ---------------------------------------------------------------------------

export async function createCharityAction(
  _prev: CharityAdminState,
  formData: FormData,
): Promise<CharityAdminState> {
  const admin = await requireAdmin();

  const parsed = readCharityForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const logo = await storePublicImage(formData.get("logo"), admin.id);
  if (logo && "error" in logo) return { status: "error", message: logo.error };

  const cover = await storePublicImage(formData.get("cover"), admin.id);
  if (cover && "error" in cover) return { status: "error", message: cover.error };

  const slug = parsed.data.slug;

  try {
    await db.insert(charities).values({
      ...parsed.data,
      tagline: parsed.data.tagline || null,
      location: parsed.data.location || null,
      websiteUrl: parsed.data.websiteUrl || null,
      logoUrl: logo?.url ?? null,
      coverImageUrl: cover?.url ?? null,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "That slug is already taken.",
        fieldErrors: { slug: ["Another charity already uses this slug"] },
      };
    }
    throw error;
  }

  const [created] = await db
    .select({ id: charities.id })
    .from(charities)
    .where(eq(charities.slug, slug))
    .limit(1);

  await audit(admin, "charity.created", created.id, { slug });
  refresh(slug);

  redirect(`/admin/charities/${created.id}`);
}

export async function updateCharityAction(
  _prev: CharityAdminState,
  formData: FormData,
): Promise<CharityAdminState> {
  const admin = await requireAdmin();

  const id = String(formData.get("charityId") ?? "");
  const parsed = readCharityForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const logo = await storePublicImage(formData.get("logo"), admin.id);
  if (logo && "error" in logo) return { status: "error", message: logo.error };

  const cover = await storePublicImage(formData.get("cover"), admin.id);
  if (cover && "error" in cover) return { status: "error", message: cover.error };

  try {
    await db
      .update(charities)
      .set({
        ...parsed.data,
        tagline: parsed.data.tagline || null,
        location: parsed.data.location || null,
        websiteUrl: parsed.data.websiteUrl || null,
        // Only replace an image when a new one was actually uploaded —
        // otherwise editing the text would silently wipe the artwork.
        ...(logo ? { logoUrl: logo.url } : {}),
        ...(cover ? { coverImageUrl: cover.url } : {}),
        updatedAt: new Date(),
      })
      .where(eq(charities.id, id));
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        status: "error",
        message: "That slug is already taken.",
        fieldErrors: { slug: ["Another charity already uses this slug"] },
      };
    }
    throw error;
  }

  await audit(admin, "charity.updated", id, { slug: parsed.data.slug });
  refresh(parsed.data.slug);

  return { status: "success", message: "Charity updated." };
}

/**
 * Removes a charity.
 *
 * Deletes outright only when nothing references it. Once money has been routed
 * through a charity, or a subscriber has chosen it, the row is deactivated
 * instead: deleting it would break historical reporting on what that charity
 * was actually paid, which is the one number nobody may lose.
 */
export async function deleteCharityAction(
  _prev: CharityAdminState,
  formData: FormData,
): Promise<CharityAdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("charityId") ?? "");

  const [{ paymentCount }] = await db
    .select({ paymentCount: sql<number>`count(*)::int` })
    .from(payments)
    .where(eq(payments.charityId, id));

  const [{ supporterCount }] = await db
    .select({ supporterCount: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.charityId, id));

  // Donations reference charities with ON DELETE RESTRICT, so a charity that has
  // received even one gift cannot be hard-deleted — without this check the
  // delete below would fail on the foreign key instead of deactivating.
  const [{ donationCount }] = await db
    .select({ donationCount: sql<number>`count(*)::int` })
    .from(donations)
    .where(eq(donations.charityId, id));

  if (paymentCount > 0 || supporterCount > 0 || donationCount > 0) {
    await db
      .update(charities)
      .set({ isActive: false, isFeatured: false, updatedAt: new Date() })
      .where(eq(charities.id, id));

    await audit(admin, "charity.deactivated", id, { paymentCount, supporterCount, donationCount });
    refresh();

    return {
      status: "success",
      message:
        supporterCount > 0
          ? `Deactivated rather than deleted — ${supporterCount} member(s) support this cause and its funding history must be kept.`
          : "Deactivated rather than deleted — payment history references this charity.",
    };
  }

  await db.delete(charities).where(eq(charities.id, id));
  await audit(admin, "charity.deleted", id);
  refresh();

  redirect("/admin/charities");
}

/** Homepage spotlight is a single slot, so featuring one clears the others. */
export async function setSpotlightAction(
  _prev: CharityAdminState,
  formData: FormData,
): Promise<CharityAdminState> {
  const admin = await requireAdmin();
  const id = String(formData.get("charityId") ?? "");

  await db.transaction(async (tx) => {
    await tx.update(charities).set({ isFeatured: false });
    await tx
      .update(charities)
      .set({ isFeatured: true, isActive: true, updatedAt: new Date() })
      .where(eq(charities.id, id));
  });

  await audit(admin, "charity.spotlighted", id);
  refresh();

  return { status: "success", message: "Spotlight updated." };
}

// --- Events (PRD §08.2: "upcoming events such as golf days") ---------------

export async function createEventAction(
  _prev: CharityAdminState,
  formData: FormData,
): Promise<CharityAdminState> {
  const admin = await requireAdmin();
  const charityId = String(formData.get("charityId") ?? "");

  const parsed = charityEventSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    startsAt: formData.get("startsAt"),
    location: formData.get("location") || undefined,
    registrationUrl: formData.get("registrationUrl") || undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Please fix the highlighted fields.",
      fieldErrors: toFieldErrors(parsed.error),
    };
  }

  const startsAt = new Date(parsed.data.startsAt);

  if (Number.isNaN(startsAt.getTime())) {
    return { status: "error", message: "That date could not be read." };
  }

  await db.insert(charityEvents).values({
    charityId,
    title: parsed.data.title,
    description: parsed.data.description || null,
    startsAt,
    location: parsed.data.location || null,
    registrationUrl: parsed.data.registrationUrl || null,
  });

  await audit(admin, "charity.event_created", charityId, { title: parsed.data.title });
  refresh();

  return { status: "success", message: "Event added." };
}

export async function deleteEventAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const eventId = String(formData.get("eventId") ?? "");

  await db.delete(charityEvents).where(eq(charityEvents.id, eventId));
  await audit(admin, "charity.event_deleted", eventId);
  refresh();
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

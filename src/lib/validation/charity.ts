import { z } from "zod";

/**
 * Charity content validation — PRD §11.03.
 *
 * Shared by the create and edit forms so a field cannot be validated one way on
 * the way in and another on the way out.
 */

/**
 * URL-safe slug.
 *
 * Generated from the name by default but editable, because a charity's public
 * URL outlives its display name — renaming "Greenfield Trust" to "Greenfield
 * Youth Trust" should not silently break every link to its profile.
 */
export const slugSchema = z
  .string()
  .trim()
  .min(2, "Slug is too short")
  .max(80, "Slug is too long")
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use lowercase letters, numbers and single hyphens",
  );

export const charitySchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(120, "That name is too long"),
  slug: slugSchema,
  tagline: z.string().trim().max(160, "Keep the tagline under 160 characters").optional(),
  summary: z
    .string()
    .trim()
    .min(20, "Write at least a sentence")
    .max(400, "Keep the summary under 400 characters"),
  description: z.string().trim().min(40, "Write a proper description"),
  category: z.string().trim().min(2, "Enter a category").max(60),
  location: z.string().trim().max(120).optional(),
  websiteUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(400)
    .optional()
    .or(z.literal("")),
  isFeatured: z.coerce.boolean().default(false),
  isActive: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

export type CharityInput = z.infer<typeof charitySchema>;

export const charityEventSchema = z.object({
  title: z.string().trim().min(3, "Enter a title").max(160),
  description: z.string().trim().max(1000).optional(),
  startsAt: z.string().min(1, "Choose a date and time"),
  location: z.string().trim().max(160).optional(),
  registrationUrl: z
    .string()
    .trim()
    .url("Enter a valid URL")
    .max(400)
    .optional()
    .or(z.literal("")),
});

/** Turns a charity name into a default slug. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    // Strip accents so "Café" becomes "cafe" rather than "caf".
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

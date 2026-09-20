/**
 * Image validation for user uploads.
 *
 * The browser-supplied `File.type` is attacker-controlled — it is whatever the
 * client says it is. Serving a file back with a content type derived from that
 * claim is a stored-XSS vector: upload an HTML document labelled `image/png`,
 * get a link to it, and the browser will happily execute it in our origin.
 *
 * So the type is determined here from the file's own leading bytes, and only
 * the formats on this list are accepted.
 *
 * SVG is deliberately excluded. It is a legitimate image format and also an
 * XML document that can carry `<script>`, so it cannot be served inline safely
 * without sanitising, which is not worth doing for a proof screenshot.
 */

/** 5 MB. Comfortably fits a phone screenshot; far below any Postgres concern. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

/** For the file input's `accept` attribute — a convenience, not a control. */
export const ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_TYPES.join(",");

type Signature = {
  mimeType: (typeof ACCEPTED_IMAGE_TYPES)[number];
  test: (bytes: Uint8Array) => boolean;
};

const SIGNATURES: Signature[] = [
  {
    // \x89 P N G \r \n \x1a \n
    mimeType: "image/png",
    test: (b) =>
      b.length > 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    // JPEG always starts FF D8 FF
    mimeType: "image/jpeg",
    test: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    // RIFF....WEBP
    mimeType: "image/webp",
    test: (b) =>
      b.length > 12 &&
      b[0] === 0x52 &&
      b[1] === 0x49 &&
      b[2] === 0x46 &&
      b[3] === 0x46 &&
      b[8] === 0x57 &&
      b[9] === 0x45 &&
      b[10] === 0x42 &&
      b[11] === 0x50,
  },
];

export type ImageValidationResult =
  | { ok: true; mimeType: (typeof ACCEPTED_IMAGE_TYPES)[number]; bytes: Buffer }
  | { ok: false; error: string };

/**
 * Validates an uploaded file and returns its true type.
 *
 * Size is checked before the bytes are read into memory, so an oversized file
 * is rejected without being buffered.
 */
export async function validateImageUpload(file: File): Promise<ImageValidationResult> {
  if (!file || file.size === 0) {
    return { ok: false, error: "Choose a file to upload." };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    const limitMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return { ok: false, error: `That file is larger than ${limitMb}MB.` };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Re-check after reading: `File.size` is also client-reported.
  if (bytes.length > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That file is too large." };
  }

  const match = SIGNATURES.find((signature) => signature.test(bytes));

  if (!match) {
    return {
      ok: false,
      error: "That file is not a PNG, JPEG or WebP image.",
    };
  }

  return { ok: true, mimeType: match.mimeType, bytes };
}

/**
 * Strips a filename down to something safe to echo back in a
 * `Content-Disposition` header.
 *
 * Path separators and control characters are removed so the value cannot break
 * out of the header or suggest a directory.
 */
export function safeFileName(name: string | null | undefined): string {
  if (!name) return "proof";

  const cleaned = name
    .replace(/[\r\n"\\]/g, "")
    .replace(/[/\\]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "")
    .trim()
    .slice(0, 120);

  return cleaned || "proof";
}

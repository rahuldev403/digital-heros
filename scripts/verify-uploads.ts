import "@/lib/load-env";

import { validateImageUpload, safeFileName } from "@/lib/image-validation";

/**
 * Upload validation checks.
 *
 * The serving route is the one place a user-supplied file is handed back to a
 * browser, so the rules that stop it becoming a stored-XSS vector are asserted
 * here rather than assumed from reading the code.
 *
 * Usage: npm run verify:uploads
 */

let failures = 0;

function check(name: string, ok: boolean, detail = "") {
  if (!ok) failures++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fileFrom(bytes: number[] | Buffer, name: string, claimedType: string): File {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  return new File([new Uint8Array(buffer)], name, { type: claimedType });
}

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0];
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0];
const WEBP_MAGIC = [
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0, 0,
];

async function main() {
  console.log("\n=== Accepts real images ===");
  {
    const png = await validateImageUpload(fileFrom(PNG_MAGIC, "a.png", "image/png"));
    check("PNG accepted", png.ok && png.mimeType === "image/png");

    const jpeg = await validateImageUpload(fileFrom(JPEG_MAGIC, "a.jpg", "image/jpeg"));
    check("JPEG accepted", jpeg.ok && jpeg.mimeType === "image/jpeg");

    const webp = await validateImageUpload(fileFrom(WEBP_MAGIC, "a.webp", "image/webp"));
    check("WebP accepted", webp.ok && webp.mimeType === "image/webp");
  }

  console.log("\n=== Rejects disguised files (the XSS path) ===");
  {
    // The attack: an HTML document that claims to be a PNG. If the stored type
    // came from `File.type`, this would later be served as text/html and run
    // script in our origin.
    const html = Buffer.from("<html><script>alert(document.cookie)</script></html>");
    const disguised = await validateImageUpload(fileFrom(html, "evil.png", "image/png"));

    check(
      "HTML claiming to be PNG is rejected",
      !disguised.ok,
      disguised.ok ? `accepted as ${disguised.mimeType}` : "",
    );

    // SVG is a real image format and also a script carrier.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    const svgResult = await validateImageUpload(fileFrom(svg, "x.svg", "image/svg+xml"));
    check("SVG is rejected", !svgResult.ok);

    // A PDF renamed to .png.
    const pdf = Buffer.from("%PDF-1.4\n...");
    const pdfResult = await validateImageUpload(fileFrom(pdf, "doc.png", "image/png"));
    check("PDF claiming to be PNG is rejected", !pdfResult.ok);

    // Empty file.
    const empty = await validateImageUpload(fileFrom([], "empty.png", "image/png"));
    check("Empty file is rejected", !empty.ok);

    // Truncated magic bytes — must not read past the end of the buffer.
    const truncated = await validateImageUpload(
      fileFrom([0x89, 0x50], "short.png", "image/png"),
    );
    check("Truncated header is rejected without throwing", !truncated.ok);
  }

  console.log("\n=== Size limit ===");
  {
    const tooBig = Buffer.concat([
      Buffer.from(PNG_MAGIC),
      Buffer.alloc(6 * 1024 * 1024),
    ]);
    const result = await validateImageUpload(fileFrom(tooBig, "big.png", "image/png"));
    check("6MB file is rejected", !result.ok, result.ok ? "accepted" : "");

    const okSize = Buffer.concat([Buffer.from(PNG_MAGIC), Buffer.alloc(1024)]);
    const okResult = await validateImageUpload(fileFrom(okSize, "ok.png", "image/png"));
    check("1KB file is accepted", okResult.ok);
  }

  console.log("\n=== Filename sanitisation (header injection) ===");
  {
    check(
      'CRLF stripped',
      !safeFileName('a\r\nSet-Cookie: x=1.png').includes("\r"),
      safeFileName('a\r\nSet-Cookie: x=1.png'),
    );
    check(
      "quotes stripped",
      !safeFileName('evil".png').includes('"'),
      safeFileName('evil".png'),
    );
    check(
      "path separators removed",
      !safeFileName("../../etc/passwd").includes("/"),
      safeFileName("../../etc/passwd"),
    );
    check("empty name falls back", safeFileName("") === "proof");
    check("null name falls back", safeFileName(null) === "proof");
    check("long name truncated", safeFileName("a".repeat(500)).length <= 120);
  }

  console.log(
    failures === 0 ? "\nAll upload checks passed.\n" : `\n${failures} check(s) FAILED.\n`,
  );

  process.exit(failures === 0 ? 0 : 1);
}

main();

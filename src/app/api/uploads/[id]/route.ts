import { NextResponse, type NextRequest } from "next/server";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { drawWinners, uploads, winnerVerifications } from "@/db/schema";
import { getCurrentUser } from "@/lib/dal";
import { safeFileName } from "@/lib/image-validation";

/**
 * Serves an uploaded proof image — PRD §09.
 *
 * These files show a named person's scorecard and are attached to a payout
 * claim, so they are private. Access is limited to the winner who uploaded the
 * file and to administrators. There is no public URL and no signed link to
 * leak: every request is authorised against the current session.
 *
 * Node runtime because it reads from Postgres.
 */
export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return new NextResponse("Not found", { status: 404 });
  }

  const { id } = await params;

  // A malformed id would otherwise reach Postgres and raise a type error.
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const [file] = await db
    .select({
      data: uploads.data,
      mimeType: uploads.mimeType,
      fileName: uploads.fileName,
      sizeBytes: uploads.sizeBytes,
      uploadedBy: uploads.uploadedBy,
      claimantId: drawWinners.userId,
    })
    .from(uploads)
    .leftJoin(winnerVerifications, eq(winnerVerifications.uploadId, uploads.id))
    .leftJoin(drawWinners, eq(winnerVerifications.drawWinnerId, drawWinners.id))
    .where(eq(uploads.id, id))
    .limit(1);

  if (!file) {
    return new NextResponse("Not found", { status: 404 });
  }

  const isOwner = file.uploadedBy === user.id || file.claimantId === user.id;
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    // 404 rather than 403: confirming that a given id exists would leak that
    // someone else made a claim.
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      // The stored type was determined from the file's own magic bytes at
      // upload time, never from what the browser claimed.
      "Content-Type": file.mimeType,
      "Content-Length": String(file.sizeBytes),
      "Content-Disposition": `inline; filename="${safeFileName(file.fileName)}"`,
      // Belt and braces: stops a browser from second-guessing the type and
      // executing the response as something else.
      "X-Content-Type-Options": "nosniff",
      // Blocks any embedded content from running if the type were ever wrong.
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      // Private to this user — never cached by a shared proxy.
      "Cache-Control": "private, max-age=3600",
    },
  });
}

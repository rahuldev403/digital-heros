"use server";

import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { requireAdmin } from "@/lib/dal";
import type { DrawMode } from "@/lib/draw-engine";
import {
  createDraw,
  lockEntries,
  publishDraw,
  resetDraw,
  simulateDraw,
} from "@/lib/services/draws";

/**
 * Draw administration — PRD §11.02.
 *
 * Every action re-checks `requireAdmin()` rather than assuming the caller came
 * from an admin page: a server action is a public endpoint, reachable by
 * anyone who can construct the request.
 *
 * Each one writes to the audit log, because these actions move money.
 */

export type AdminActionState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

async function audit(
  actorId: string,
  actorEmail: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await db.insert(auditLogs).values({
    actorId,
    actorEmail,
    action,
    entityType: "draw",
    entityId,
    metadata,
  });
}

function refresh() {
  revalidatePath("/admin/draws");
  revalidatePath("/admin");
  revalidatePath("/draws");
  revalidatePath("/dashboard/draws");
}

export async function createDrawAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const periodKey = String(formData.get("periodKey") ?? "");
  const mode = (String(formData.get("mode") ?? "random") as DrawMode) ?? "random";

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodKey)) {
    return { status: "error", message: "Enter a period as YYYY-MM." };
  }

  const draw = await createDraw(periodKey, mode);
  await audit(admin.id, admin.email, "draw.created", draw.id, { periodKey, mode });

  refresh();
  return { status: "success", message: `${draw.name} created.` };
}

export async function lockEntriesAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const drawId = String(formData.get("drawId") ?? "");

  const result = await lockEntries(drawId);

  if (!result.ok) return { status: "error", message: result.error! };

  await audit(admin.id, admin.email, "draw.entries_locked", drawId, {
    entryCount: result.entryCount,
  });

  refresh();
  return {
    status: "success",
    message: `${result.entryCount} entries locked in.`,
  };
}

export async function simulateDrawAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();

  const drawId = String(formData.get("drawId") ?? "");
  const modeValue = String(formData.get("mode") ?? "");
  const mode = modeValue === "algorithmic" || modeValue === "random" ? modeValue : undefined;

  const result = await simulateDraw(drawId, mode);

  if (!result.ok) return { status: "error", message: result.error! };

  await audit(admin.id, admin.email, "draw.simulated", drawId, {
    mode: result.draw?.mode,
    winningNumbers: result.draw?.winningNumbers,
    seed: result.draw?.randomSeed,
  });

  refresh();
  return {
    status: "success",
    message: `Drawn: ${result.draw?.winningNumbers?.join(", ")}. Not visible to players until published.`,
  };
}

export async function publishDrawAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const drawId = String(formData.get("drawId") ?? "");

  const result = await publishDraw(drawId, admin.id);

  if (!result.ok) return { status: "error", message: result.error! };

  await audit(admin.id, admin.email, "draw.published", drawId);

  refresh();
  return { status: "success", message: "Published. Results are now public." };
}

export async function resetDrawAction(
  _prev: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  const admin = await requireAdmin();
  const drawId = String(formData.get("drawId") ?? "");

  const result = await resetDraw(drawId);

  if (!result.ok) return { status: "error", message: result.error! };

  await audit(admin.id, admin.email, "draw.reset", drawId);

  refresh();
  return { status: "success", message: "Reset to draft." };
}

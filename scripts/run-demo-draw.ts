import "@/lib/load-env";

import { eq } from "drizzle-orm";

import { db, pool } from "@/db";
import { users } from "@/db/schema";
import { formatMoney } from "@/lib/money";
import { currentPeriodKey, shiftPeriodKey } from "@/lib/period";
import {
  createDraw,
  listDrawWinners,
  lockEntries,
  publishDraw,
  simulateDraw,
} from "@/lib/services/draws";

/**
 * Runs and publishes a draw for a past period, so the platform has a completed
 * draw to display without anyone having to click through the admin panel
 * first.
 *
 * Additive: it touches only the draw it creates, so it is safe to run against a
 * database with real accounts in it — unlike `db:seed`, which truncates.
 *
 * Usage: npm run demo:draw [-- 2026-08] [--mode algorithmic]
 */
async function main() {
  const args = process.argv.slice(2);
  const periodArg = args.find((a) => /^\d{4}-\d{2}$/.test(a));
  const modeIndex = args.indexOf("--mode");
  const mode =
    modeIndex !== -1 && args[modeIndex + 1] === "algorithmic"
      ? ("algorithmic" as const)
      : ("random" as const);

  // Default to last month, leaving the current period open to experiment with.
  const periodKey = periodArg ?? shiftPeriodKey(currentPeriodKey(), -1);

  console.log(`\nRunning draw for ${periodKey} (${mode})\n`);

  const draw = await createDraw(periodKey, mode);
  console.log(`  created   ${draw.name}`);

  const locked = await lockEntries(draw.id);
  if (!locked.ok) throw new Error(locked.error);
  console.log(`  locked    ${locked.entryCount} entries`);

  const simulated = await simulateDraw(draw.id, mode);
  if (!simulated.ok) throw new Error(simulated.error);

  const result = simulated.draw!;
  console.log(`  drawn     ${result.winningNumbers?.join(", ")}`);
  console.log(`  seed      ${result.randomSeed}`);
  console.log(
    `  pool      ${formatMoney(result.totalPoolMinor, result.currency)} ` +
      `(base ${formatMoney(result.basePoolMinor, result.currency)} + rollover ${formatMoney(result.rolloverInMinor, result.currency)})`,
  );

  const winners = await listDrawWinners(draw.id);
  console.log(`  winners   ${winners.length}`);

  for (const winner of winners) {
    console.log(
      `             match-${winner.tier}  ${winner.fullName.padEnd(20)} ` +
        `${formatMoney(winner.prizeMinor, winner.currency)}`,
    );
  }

  // Publishing is attributed to an admin, as it is in the UI.
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "admin"))
    .limit(1);

  if (!admin) throw new Error("No admin user found — run `npm run db:seed` first.");

  const published = await publishDraw(draw.id, admin.id);
  if (!published.ok) throw new Error(published.error);

  const paidOut = winners.reduce((sum, w) => sum + w.prizeMinor, 0);

  console.log(`  published\n`);
  console.log(`  Paid to winners  ${formatMoney(paidOut, result.currency)}`);
  console.log(`  Rolls over       ${formatMoney(result.rolloverOutMinor, result.currency)}`);
  console.log(`  Undistributed    ${formatMoney(result.undistributedMinor, result.currency)}`);

  // The invariant from the draw engine, re-checked against what actually
  // landed in the database.
  const balanced =
    paidOut + result.rolloverOutMinor + result.undistributedMinor ===
    result.totalPoolMinor;

  console.log(
    `\n  Books balance:   ${balanced ? "YES" : "NO — investigate"}  ` +
      `(${paidOut} + ${result.rolloverOutMinor} + ${result.undistributedMinor} = ${result.totalPoolMinor})\n`,
  );

  if (!balanced) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Demo draw failed:", error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

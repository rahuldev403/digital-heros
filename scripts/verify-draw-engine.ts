import "@/lib/load-env";

import { PRIZE_TIERS, TIER_SHARE_BPS, type PrizeTier } from "@/lib/constants";
import {
  buildFrequencyWeights,
  calculatePrizes,
  countMatches,
  createRng,
  drawWinningNumbers,
} from "@/lib/draw-engine";
import { amortisedShare } from "@/lib/money";
import { monthsBetween } from "@/lib/period";

/**
 * Draw engine verification.
 *
 * The draw engine decides who gets paid, so its properties are checked
 * directly rather than inferred from the UI looking right. Run with
 * `npm run verify:draw`.
 */

let failures = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  PASS  ${name}`);
  } else {
    failures++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

console.log("\n=== Matching (multiset, decision D1) ===");
{
  // The exact bug a naive `filter/includes` would produce.
  const entry = [32, 32, 18, 7, 41];
  const winning = [32, 18, 5, 9, 12];
  const matched = countMatches(entry, winning);

  check(
    "duplicate score matches once, not twice",
    matched.length === 2,
    `got ${matched.length} (${matched.join(",")})`,
  );

  const naive = entry.filter((n) => winning.includes(n)).length;
  check(
    "naive set-intersection would have been wrong",
    naive === 3 && naive !== matched.length,
    `naive=${naive}`,
  );

  check("no matches yields empty", countMatches([1, 2, 3], [40, 41, 42]).length === 0);
  check(
    "all five match",
    countMatches([1, 2, 3, 4, 5], [5, 4, 3, 2, 1]).length === 5,
  );
  check(
    "two duplicates match two drawn duplicates — impossible here",
    // Winning numbers are drawn without replacement, so a pair can never both
    // match. This pins that guarantee.
    countMatches([7, 7], [7]).length === 1,
  );
}

console.log("\n=== Determinism ===");
{
  const a = drawWinningNumbers({ mode: "random", seed: "seed-alpha" });
  const b = drawWinningNumbers({ mode: "random", seed: "seed-alpha" });
  const c = drawWinningNumbers({ mode: "random", seed: "seed-beta" });

  check("same seed reproduces the same draw", a.join(",") === b.join(","));
  check("different seed gives a different draw", a.join(",") !== c.join(","));
  check("five numbers drawn", a.length === 5, `got ${a.length}`);
  check("numbers are distinct", new Set(a).size === 5);
  check(
    "numbers within 1..45",
    a.every((n) => n >= 1 && n <= 45),
    a.join(","),
  );
  check("numbers returned sorted", a.join(",") === [...a].sort((x, y) => x - y).join(","));
}

console.log("\n=== Uniformity (random mode) ===");
{
  const counts = new Map<number, number>();
  const trials = 20_000;

  for (let i = 0; i < trials; i++) {
    for (const n of drawWinningNumbers({ mode: "random", seed: `t${i}` })) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
  }

  const expected = (trials * 5) / 45;
  const values = [...counts.values()];
  const maxDeviation = Math.max(...values.map((v) => Math.abs(v - expected) / expected));

  check("all 45 numbers occur", counts.size === 45, `saw ${counts.size}`);
  check(
    "no number deviates more than 8% from uniform",
    maxDeviation < 0.08,
    `max deviation ${(maxDeviation * 100).toFixed(2)}%`,
  );
}

console.log("\n=== Algorithmic weighting ===");
{
  // Everybody scored 20; nobody scored anything else.
  const entries = Array.from({ length: 200 }, () => [20, 20, 20, 20, 20]);
  const weights = buildFrequencyWeights(entries);

  check("unscored numbers keep weight 1 (never impossible)", weights.get(33) === 1);
  check("scored number is weighted up", (weights.get(20) ?? 0) > 500);

  let hits20 = 0;
  const trials = 4000;
  for (let i = 0; i < trials; i++) {
    if (drawWinningNumbers({ mode: "algorithmic", seed: `a${i}`, entries }).includes(20)) {
      hits20++;
    }
  }

  const rate = hits20 / trials;
  // Uniform would hit 20 about 5/45 = 11% of the time.
  check(
    "heavily-scored number is drawn far more often than uniform",
    rate > 0.6,
    `rate ${(rate * 100).toFixed(1)}%`,
  );

  // Still a draw over the whole range, not a fixed result.
  const sample = drawWinningNumbers({ mode: "algorithmic", seed: "a1", entries });
  check("still returns five distinct numbers", new Set(sample).size === 5);
}

console.log("\n=== Prize distribution (PRD §07) ===");
{
  const cases: Array<{ name: string; pool: number; winners: Record<PrizeTier, number> }> = [
    { name: "no winners at all", pool: 100_000, winners: { 3: 0, 4: 0, 5: 0 } },
    { name: "one winner in every tier", pool: 100_000, winners: { 3: 1, 4: 1, 5: 1 } },
    { name: "indivisible thirds", pool: 100_001, winners: { 3: 3, 4: 3, 5: 3 } },
    { name: "many winners", pool: 999_999, winners: { 3: 137, 4: 29, 5: 2 } },
    { name: "empty pool", pool: 0, winners: { 3: 5, 4: 1, 5: 0 } },
    { name: "one cent", pool: 1, winners: { 3: 1, 4: 1, 5: 1 } },
  ];

  for (const { name, pool, winners } of cases) {
    const result = calculatePrizes(pool, winners);

    const paidOut = result.tiers.reduce(
      (sum, t) => sum + t.prizePerWinnerMinor * t.winnerCount,
      0,
    );
    const total = paidOut + result.rolloverOutMinor + result.undistributedMinor;

    check(
      `books balance: ${name}`,
      total === pool,
      `paid=${paidOut} rollover=${result.rolloverOutMinor} undistributed=${result.undistributedMinor} total=${total} pool=${pool}`,
    );

    check(
      `no negative amounts: ${name}`,
      result.tiers.every((t) => t.prizePerWinnerMinor >= 0 && t.remainderMinor >= 0) &&
        result.rolloverOutMinor >= 0 &&
        result.undistributedMinor >= 0,
    );
  }

  // Jackpot rolls over; lower tiers do not.
  const noWinners = calculatePrizes(100_000, { 3: 0, 4: 0, 5: 0 });
  const jackpotSlice = (100_000 * TIER_SHARE_BPS[5]) / 10_000;

  check(
    "unclaimed match-5 rolls over",
    noWinners.rolloverOutMinor === jackpotSlice,
    `rollover=${noWinners.rolloverOutMinor} expected=${jackpotSlice}`,
  );
  check(
    "unclaimed match-4 and match-3 do NOT roll over",
    noWinners.tiers.filter((t) => t.rolledOver).length === 1,
  );

  // Equal split, remainder retained rather than gifted.
  const thirds = calculatePrizes(100_001, { 3: 3, 4: 3, 5: 3 });
  for (const tier of thirds.tiers) {
    check(
      `match-${tier.tier}: every winner receives an identical amount`,
      tier.remainderMinor < tier.winnerCount,
      `remainder=${tier.remainderMinor} winners=${tier.winnerCount}`,
    );
  }

  check(
    "tier shares total 100%",
    PRIZE_TIERS.reduce((s, t) => s + TIER_SHARE_BPS[t], 0) === 10_000,
  );
}

console.log("\n=== RNG sanity ===");
{
  const rng = createRng("x");
  const values = Array.from({ length: 1000 }, () => rng());

  check("all values in [0,1)", values.every((v) => v >= 0 && v < 1));
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  check("mean near 0.5", Math.abs(mean - 0.5) < 0.05, `mean=${mean.toFixed(4)}`);
}

console.log("\n=== Yearly amortisation (decision D17) ===");
{
  const totals = [0, 1, 11, 12, 13, 2997, 29970, 99_999, 123_457];
  let exact = true;
  let even = true;

  for (const total of totals) {
    const slices = Array.from({ length: 12 }, (_, k) => amortisedShare(total, 12, k));
    if (slices.reduce((a, b) => a + b, 0) !== total) exact = false;
    if (Math.max(...slices) - Math.min(...slices) > 1) even = false;
  }

  check("twelve slices always sum to the whole", exact);
  check("slices never differ by more than one cent", even);
  check("index outside the year funds nothing", amortisedShare(2997, 12, 12) === 0 && amortisedShare(2997, 12, -1) === 0);
  check("a yearly €29.97 pool share funds ~€2.50 a month", amortisedShare(2997, 12, 0) === 250);

  check("monthsBetween within a year", monthsBetween("2026-01", "2026-03") === 2);
  check("monthsBetween across a year boundary", monthsBetween("2025-11", "2026-02") === 3);
  check("monthsBetween same month is zero", monthsBetween("2026-09", "2026-09") === 0);
  check("monthsBetween backwards is negative", monthsBetween("2026-09", "2026-08") === -1);
}

console.log(
  failures === 0
    ? "\nAll draw engine checks passed.\n"
    : `\n${failures} check(s) FAILED.\n`,
);

process.exit(failures === 0 ? 0 : 1);

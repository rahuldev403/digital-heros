import {
  DRAW_NUMBER_MAX,
  DRAW_NUMBER_MIN,
  NUMBERS_PER_ENTRY,
  PRIZE_TIERS,
  ROLLOVER_TIERS,
  TIER_SHARE_BPS,
  type PrizeTier,
} from "./constants";
import { applyBps, divideEvenly } from "./money";

/**
 * Draw engine — PRD §06, §07.
 *
 * Deliberately pure: no database, no clock, no `Math.random`. Every function
 * here is a deterministic transformation of its arguments, which is what lets
 * a draw be simulated repeatedly before publishing (§06 "Simulation before
 * publish") and re-verified afterwards from its stored seed.
 *
 * The database orchestration that calls these lives in `services/draws.ts`.
 */

// ---------------------------------------------------------------------------
// Deterministic randomness
// ---------------------------------------------------------------------------

/**
 * Seeded PRNG (mulberry32).
 *
 * `Math.random()` cannot be used for a draw that pays out money: the result
 * would be unreproducible, so nobody — including us — could later demonstrate
 * that the numbers were not chosen after the entries were known. Seeding from a
 * stored value means anyone holding the seed can replay the draw and get the
 * same numbers.
 */
export function createRng(seed: string): () => number {
  // Hash the string seed into a 32-bit integer (FNV-1a).
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let state = hash >>> 0;

  return function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cryptographically random seed, generated once when a draw is simulated. */
export function generateSeed(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/**
 * Counts how many of a player's numbers appear in the winning set.
 *
 * This is a **multiset** intersection, not a set intersection. A player's
 * numbers are their Stableford scores (see decision D1) and scores repeat — two
 * rounds of 32 is ordinary. If the draw produces a single 32, that should match
 * once, not twice.
 *
 * `entry.filter(n => winning.includes(n)).length` gets this wrong: it would
 * report 2. Consuming each winning number as it is matched is what makes the
 * count correct.
 */
export function countMatches(entry: number[], winning: number[]): number[] {
  const pool = [...winning];
  const matched: number[] = [];

  for (const number of entry) {
    const index = pool.indexOf(number);
    if (index !== -1) {
      pool.splice(index, 1);
      matched.push(number);
    }
  }

  return matched;
}

// ---------------------------------------------------------------------------
// Drawing numbers
// ---------------------------------------------------------------------------

export type DrawMode = "random" | "algorithmic";

/**
 * Produces the winning numbers.
 *
 * **random** — each of the 45 numbers is equally likely, as in any lottery.
 *
 * **algorithmic** — numbers are weighted by how often they appear across all
 * entries (§06 "weighted by score frequency"). Common scores are more likely to
 * be drawn, so more players win something and the pool is spread across more
 * people. This is a different product, not a fairer one, which is why it is an
 * admin choice per draw rather than a global setting.
 *
 * Both draw **without replacement**: a number already drawn is removed from the
 * pool, so the five winning numbers are always distinct. Note the asymmetry
 * this creates with entries, which *may* repeat — that is intentional, and it
 * caps any single entry at five matches.
 */
export function drawWinningNumbers(options: {
  mode: DrawMode;
  seed: string;
  /** All entries, used only in algorithmic mode to build the weighting. */
  entries?: number[][];
  count?: number;
  min?: number;
  max?: number;
}): number[] {
  const {
    mode,
    seed,
    entries = [],
    count = NUMBERS_PER_ENTRY,
    min = DRAW_NUMBER_MIN,
    max = DRAW_NUMBER_MAX,
  } = options;

  const rng = createRng(seed);
  const candidates: number[] = [];
  for (let n = min; n <= max; n++) candidates.push(n);

  if (mode === "random") {
    return drawUniform(rng, candidates, count);
  }

  return drawWeighted(rng, candidates, buildFrequencyWeights(entries, min, max), count);
}

/** Uniform selection without replacement (partial Fisher–Yates). */
function drawUniform(rng: () => number, pool: number[], count: number): number[] {
  const items = [...pool];
  const picked: number[] = [];

  for (let i = 0; i < count && items.length > 0; i++) {
    const index = Math.floor(rng() * items.length);
    picked.push(items.splice(index, 1)[0]);
  }

  return picked.sort((a, b) => a - b);
}

/**
 * Frequency weights across every entry.
 *
 * Every number starts at weight 1 rather than 0, so a number nobody has scored
 * is unlikely rather than impossible. A weight of 0 would make parts of the
 * range unreachable, which stops it being a draw over 1–45 at all.
 */
export function buildFrequencyWeights(
  entries: number[][],
  min = DRAW_NUMBER_MIN,
  max = DRAW_NUMBER_MAX,
): Map<number, number> {
  const weights = new Map<number, number>();
  for (let n = min; n <= max; n++) weights.set(n, 1);

  for (const entry of entries) {
    for (const number of entry) {
      if (number < min || number > max) continue;
      weights.set(number, (weights.get(number) ?? 1) + 1);
    }
  }

  return weights;
}

/** Weighted selection without replacement (roulette wheel, re-normalised). */
function drawWeighted(
  rng: () => number,
  pool: number[],
  weights: Map<number, number>,
  count: number,
): number[] {
  const items = [...pool];
  const picked: number[] = [];

  for (let i = 0; i < count && items.length > 0; i++) {
    const total = items.reduce((sum, n) => sum + (weights.get(n) ?? 1), 0);
    let threshold = rng() * total;

    let chosenIndex = items.length - 1; // guards against float drift
    for (let j = 0; j < items.length; j++) {
      threshold -= weights.get(items[j]) ?? 1;
      if (threshold <= 0) {
        chosenIndex = j;
        break;
      }
    }

    picked.push(items.splice(chosenIndex, 1)[0]);
  }

  return picked.sort((a, b) => a - b);
}

// ---------------------------------------------------------------------------
// Prize calculation
// ---------------------------------------------------------------------------

export interface TierOutcome {
  tier: PrizeTier;
  shareBps: number;
  /** The tier's slice of the pool, before splitting between winners. */
  tierPoolMinor: number;
  winnerCount: number;
  /** What each winner in this tier receives. */
  prizePerWinnerMinor: number;
  /** Left over because the tier did not divide evenly. */
  remainderMinor: number;
  /** True when nobody won and the slice carries to the next draw. */
  rolledOver: boolean;
}

export interface PrizeBreakdown {
  totalPoolMinor: number;
  tiers: TierOutcome[];
  /** Carried into the next draw (unclaimed jackpot). */
  rolloverOutMinor: number;
  /** Rounding remainders, retained so the books balance exactly. */
  undistributedMinor: number;
}

/**
 * Splits a pool across the three tiers and their winners — PRD §07.
 *
 * Every division states where its remainder goes. A tier that cannot divide
 * evenly does not hand the odd cent to one lucky winner: prizes must be "split
 * equally", so the remainder is retained and reported. A tier with no winners
 * either rolls over (match-5, the jackpot) or is retained (match-4 and 3, which
 * the PRD marks "No" for rollover).
 *
 * Invariant, asserted by the caller's tests:
 *   sum(prizePerWinner × winnerCount) + rolloverOut + undistributed
 *     === totalPool
 */
export function calculatePrizes(
  totalPoolMinor: number,
  winnerCountByTier: Record<PrizeTier, number>,
  tierSharesBps: Record<PrizeTier, number> = TIER_SHARE_BPS,
): PrizeBreakdown {
  const tiers: TierOutcome[] = [];
  let rolloverOutMinor = 0;
  let undistributedMinor = 0;

  for (const tier of PRIZE_TIERS) {
    const shareBps = tierSharesBps[tier];
    const tierPoolMinor = applyBps(totalPoolMinor, shareBps);
    const winnerCount = winnerCountByTier[tier] ?? 0;

    if (winnerCount === 0) {
      const rolls = ROLLOVER_TIERS.includes(tier);

      if (rolls) {
        rolloverOutMinor += tierPoolMinor;
      } else {
        // Not a rollover tier, so it cannot carry forward; it stays in the pot.
        undistributedMinor += tierPoolMinor;
      }

      tiers.push({
        tier,
        shareBps,
        tierPoolMinor,
        winnerCount: 0,
        prizePerWinnerMinor: 0,
        remainderMinor: rolls ? 0 : tierPoolMinor,
        rolledOver: rolls,
      });

      continue;
    }

    const { shareMinor, remainderMinor } = divideEvenly(tierPoolMinor, winnerCount);
    undistributedMinor += remainderMinor;

    tiers.push({
      tier,
      shareBps,
      tierPoolMinor,
      winnerCount,
      prizePerWinnerMinor: shareMinor,
      remainderMinor,
      rolledOver: false,
    });
  }

  // Basis points are rounded per tier, so the three slices can differ from the
  // pool by a cent or two. Attribute that difference rather than losing it.
  const allocated = tiers.reduce((sum, t) => sum + t.tierPoolMinor, 0);
  undistributedMinor += totalPoolMinor - allocated;

  return {
    totalPoolMinor,
    tiers,
    rolloverOutMinor,
    undistributedMinor,
  };
}

/** Tiers ordered jackpot-first, for display. */
export function tiersDescending(breakdown: PrizeBreakdown): TierOutcome[] {
  return [...breakdown.tiers].sort((a, b) => b.tier - a.tier);
}

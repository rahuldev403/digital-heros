/**
 * Domain constants.
 *
 * Everything here is a business rule lifted directly from the PRD. Keeping them
 * in one place means the draw engine, the validators, the seed script and the
 * UI all agree on the same numbers.
 */

// ---------------------------------------------------------------------------
// Scores (PRD §05)
// ---------------------------------------------------------------------------

/** Stableford points are bounded 1–45 inclusive. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 45;

/** Only the latest 5 scores are retained per user; a 6th evicts the oldest. */
export const SCORES_RETAINED = 5;

// ---------------------------------------------------------------------------
// Draw engine (PRD §06)
// ---------------------------------------------------------------------------

/**
 * THE CENTRAL DESIGN DECISION OF THIS PLATFORM.
 *
 * The PRD specifies a Stableford score range of 1–45 (§05) and, separately, a
 * lottery-style draw matching 3, 4 or 5 numbers (§06). It never states where a
 * player's numbers come from — that is one of the deliberate ambiguities the
 * brief mentions ("ambiguity is part of the test", §17).
 *
 * We resolve it by making the two the same thing: a player's five retained
 * Stableford scores ARE their five draw numbers. The ranges line up exactly
 * (1–45, five of them), and it is the only reading that makes the two engines a
 * single product rather than a golf tracker with a lottery bolted on:
 *
 *   - Playing golf is how you enter. No separate "pick your numbers" step.
 *   - Score entry becomes emotionally loaded — every round changes your ticket.
 *   - "Algorithmic draw weighted by score frequency" (§06) only has a coherent
 *     meaning if scores and numbers share a namespace.
 *
 * Consequence we accept: scores may repeat (two rounds of 32), so an entry is a
 * multiset, not a set. Matching therefore counts multiset intersection — see
 * `countMatches` in the draw engine.
 */
export const DRAW_NUMBER_MIN = SCORE_MIN;
export const DRAW_NUMBER_MAX = SCORE_MAX;
export const NUMBERS_PER_ENTRY = SCORES_RETAINED;

/** A player must have a full set of five scores to be entered into a draw. */
export const MIN_SCORES_FOR_ENTRY = SCORES_RETAINED;

/** Winning tiers, lowest qualifying match first. */
export const PRIZE_TIERS = [3, 4, 5] as const;
export type PrizeTier = (typeof PRIZE_TIERS)[number];

/**
 * Prize pool distribution (PRD §07), in basis points so the split stays exact
 * in integer arithmetic. Must total 10_000.
 */
export const TIER_SHARE_BPS: Record<PrizeTier, number> = {
  5: 4000, // 40% — jackpot, rolls over if unclaimed
  4: 3500, // 35%
  3: 2500, // 25%
};

/** Only the 5-match jackpot carries forward when nobody wins it (PRD §07). */
export const ROLLOVER_TIERS: PrizeTier[] = [5];

// ---------------------------------------------------------------------------
// Charity (PRD §08)
// ---------------------------------------------------------------------------

/** Minimum share of a subscription fee that must go to the chosen charity. */
export const CHARITY_MIN_PERCENT = 10;

/**
 * Ceiling on the voluntary increase (PRD §08.1: "users may voluntarily increase
 * their charity percentage" — without saying how far).
 *
 * It is 100% minus the prize-pool share below, i.e. a user may give away the
 * entire platform margin but cannot eat into the prize pool. Letting one
 * generous user shrink the pool would quietly reduce everyone else's winnings,
 * which is the wrong trade to allow silently.
 */
export const CHARITY_MAX_PERCENT = 70;

// ---------------------------------------------------------------------------
// Prize pool funding (PRD §07)
// ---------------------------------------------------------------------------

/**
 * "A fixed portion of each subscription contributes to the prize pool."
 * The PRD does not name the portion, so it is configurable per plan
 * (`plans.prize_pool_share_bps`) and this is the default applied at seed time.
 *
 * Default split of a subscription fee: 10% charity (minimum), 30% prize pool,
 * 60% platform. Raising the charity percentage takes from the platform share,
 * never from the prize pool — otherwise generous users would shrink the pool
 * for everyone else.
 */
export const DEFAULT_PRIZE_POOL_SHARE_BPS = 3000;

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

/** Session lifetime. Sessions are stored server-side and revocable. */
export const SESSION_TTL_DAYS = 30;
export const SESSION_COOKIE_NAME = "dh_session";

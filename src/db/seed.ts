import { config as loadEnv } from "dotenv";

loadEnv({ path: [".env.local", ".env"], quiet: true });

import { sql } from "drizzle-orm";

import { db, pool } from "./index";
import {
  charities,
  charityEvents,
  payments,
  plans,
  platformSettings,
  scores,
  subscriptions,
  users,
} from "./schema";

import {
  CHARITY_MIN_PERCENT,
  DEFAULT_PRIZE_POOL_SHARE_BPS,
  SCORE_MAX,
  SCORE_MIN,
  SCORES_RETAINED,
  TIER_SHARE_BPS,
} from "@/lib/constants";
import { splitSubscriptionPayment } from "@/lib/money";
import { hashPassword } from "@/lib/password";
import { currentPeriodKey, shiftPeriodKey } from "@/lib/period";

/**
 * Development seed.
 *
 * Produces a platform that already looks lived-in: charities with events, a
 * population of subscribers with score histories, and several months of
 * payments so the prize pool has real money in it. Empty-state screenshots
 * prove nothing about a draw engine.
 *
 * Deterministic by design — the same run produces the same data, so a bug found
 * while demoing can be reproduced exactly.
 *
 * Run with `npm run db:seed`. Destructive: it truncates every table first.
 */

const CURRENCY = process.env.NEXT_PUBLIC_CURRENCY ?? "INR";

// ---------------------------------------------------------------------------
// Deterministic RNG (mulberry32)
// ---------------------------------------------------------------------------

function makeRng(seed: number) {
  let state = seed;

  return function next(): number {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260320);

const randomInt = (min: number, max: number) =>
  min + Math.floor(rng() * (max - min + 1));

const pick = <T,>(items: readonly T[]): T => items[randomInt(0, items.length - 1)];

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

const CHARITY_SEED = [
  {
    slug: "greenfield-youth-trust",
    name: "Greenfield Youth Trust",
    tagline: "Putting a club in every kid's hands",
    category: "Youth",
    location: "Bengaluru, IN",
    summary:
      "Funds coaching, equipment and range time for children who would never otherwise set foot on a course.",
    description:
      "Greenfield Youth Trust runs after-school programmes across twelve municipal schools. Every rupee raised covers coaching hours, second-hand equipment refurbishment, and transport to partner courses. In the last year the Trust put 1,400 children through a first golf session, and 210 of them stayed on into structured coaching. Funding from Digital Heroes subscribers pays for the part nobody else will: the transport.",
    isFeatured: true,
  },
  {
    slug: "fairway-mind",
    name: "Fairway Mind",
    tagline: "Mental health support for sportspeople",
    category: "Health",
    location: "Mumbai, IN",
    summary:
      "Free, confidential counselling for amateur and professional athletes dealing with performance anxiety and burnout.",
    description:
      "Fairway Mind was founded by two former tour players after a season that neither of them talks about publicly. It operates a free helpline staffed by sports psychologists, and funds six sessions of therapy for any athlete who asks. There is no waiting list and no means test. The service is deliberately anonymous, which makes it hard to fundraise for — recurring subscriber contributions are the reason it can plan beyond a quarter.",
    isFeatured: false,
  },
  {
    slug: "caddie-futures",
    name: "Caddie Futures",
    tagline: "Education for caddies and their families",
    category: "Education",
    location: "Kolkata, IN",
    summary:
      "Scholarships and evening classes for caddies, greenkeepers and their children.",
    description:
      "Caddie Futures pays school fees, buys uniforms and runs evening literacy and English classes at three clubs. Most caddies work six days a week; the programme is built around their hours, not the other way round. Forty-one children of Caddie Futures families are currently in full-time education on scholarships the charity funds outright.",
    isFeatured: false,
  },
  {
    slug: "open-greens-access",
    name: "Open Greens Access",
    tagline: "Adaptive golf for disabled players",
    category: "Accessibility",
    location: "Chennai, IN",
    summary:
      "Adaptive equipment, accessible buggies and trained coaches so disability is not a barrier to play.",
    description:
      "Open Greens Access converts ordinary courses into playable ones: single-rider adaptive carts, modified clubs, and coaches trained to work with amputee, wheelchair and visually impaired golfers. The charity has made nine courses genuinely accessible and runs a monthly open day at each. Equipment is the cost — one adaptive cart is more than a year of coaching.",
    isFeatured: false,
  },
  {
    slug: "water-for-wickets",
    name: "Water for Wickets",
    tagline: "Clean water for sporting communities",
    category: "Environment",
    location: "Pune, IN",
    summary:
      "Builds and maintains clean water infrastructure in villages neighbouring sports grounds and courses.",
    description:
      "Golf courses consume water in places where households queue for it. Water for Wickets works the other side of that equation: borewells, filtration and rainwater harvesting for the villages that border major courses, funded in part by the courses themselves. Fourteen installations are live, serving roughly 9,000 people.",
    isFeatured: false,
  },
  {
    slug: "second-swing",
    name: "Second Swing",
    tagline: "Rehabilitation through sport for veterans",
    category: "Veterans",
    location: "Delhi, IN",
    summary:
      "Uses golf as physical and social rehabilitation for injured service personnel.",
    description:
      "Second Swing runs twelve-week rehabilitation blocks combining physiotherapy with coaching, for veterans recovering from physical injury and for those managing PTSD. The golf is the pretext; the structure and the company are the treatment. Referrals come directly from military hospitals, and the programme is free at the point of use.",
    isFeatured: false,
  },
  {
    slug: "the-turning-point",
    name: "The Turning Point",
    tagline: "Employment pathways out of homelessness",
    category: "Housing",
    location: "Hyderabad, IN",
    summary:
      "Trains and places people experiencing homelessness into groundskeeping and hospitality roles.",
    description:
      "The Turning Point recruits from shelters and runs a paid twelve-week traineeship in greenkeeping, kitchen work and front-of-house, ending in a guaranteed interview with a partner club. Seventy-three percent of trainees are still employed a year later. The charity's cost per placement is a fraction of what a night in emergency accommodation costs the state.",
    isFeatured: false,
  },
  {
    slug: "junior-links-foundation",
    name: "Junior Links Foundation",
    tagline: "Girls' golf, properly funded",
    category: "Youth",
    location: "Ahmedabad, IN",
    summary:
      "Closes the funding gap between boys' and girls' junior golf programmes.",
    description:
      "Junior Links Foundation exists because junior girls' programmes are routinely funded at a third of the level of boys'. It funds coaching, tournament entry fees and travel for girls aged 9–18, and covers the entry costs that quietly exclude players whose families cannot absorb them. It now supports 260 players across six states.",
    isFeatured: false,
  },
] as const;

const COURSE_NAMES = [
  "Karnataka Golf Association",
  "Royal Calcutta",
  "Willingdon Sports Club",
  "Bombay Presidency",
  "Oxford Golf Resort",
  "Prestige Golfshire",
  "DLF Golf & Country Club",
  "Eagleton Resort",
] as const;

const FIRST_NAMES = [
  "Aarav", "Diya", "Rohan", "Ishita", "Kabir", "Ananya", "Vikram", "Meera",
  "Arjun", "Priya", "Siddharth", "Nisha", "Rahul", "Tara", "Aditya", "Kavya",
  "Karan", "Sneha", "Manish", "Riya", "Dev", "Pooja", "Nikhil", "Anjali",
] as const;

const LAST_NAMES = [
  "Sharma", "Patel", "Reddy", "Nair", "Iyer", "Singh", "Gupta", "Mehta",
  "Bose", "Kulkarni", "Chauhan", "Menon",
] as const;

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");

  // This script truncates everything. Running it against a deployed database
  // would destroy real users, real payments and real draw history.
  if (!isLocal && process.argv[2] !== "--force") {
    throw new Error(
      "Refusing to seed a non-local database.\n" +
        "This deletes all data. Re-run with `npm run db:seed -- --force` if that is genuinely intended.",
    );
  }

  console.log("Clearing existing data...");

  // One statement so foreign keys never see a partially-cleared database.
  // RESTART IDENTITY keeps repeat runs byte-identical.
  await db.execute(sql`
    TRUNCATE TABLE
      audit_logs, platform_settings, winner_verifications, draw_winners,
      draw_entries, draws, scores, donations, payments, subscriptions,
      sessions, users, charity_events, charities, plans
    RESTART IDENTITY CASCADE
  `);

  // --- Platform settings ---------------------------------------------------

  console.log("Seeding platform settings...");

  await db.insert(platformSettings).values([
    {
      key: "draw.default_mode",
      value: "random",
      description: "Draw mode applied to newly created draws: 'random' or 'algorithmic'.",
    },
    {
      key: "draw.tier_shares_bps",
      value: TIER_SHARE_BPS,
      description: "Prize pool distribution by match tier, in basis points (PRD §07).",
    },
    {
      key: "charity.min_percent",
      value: CHARITY_MIN_PERCENT,
      description: "Minimum share of a subscription fee routed to charity (PRD §08.1).",
    },
    {
      key: "homepage.spotlight_charity_slug",
      value: CHARITY_SEED[0].slug,
      description: "Charity featured in the homepage spotlight section.",
    },
  ]);

  // --- Plans ---------------------------------------------------------------

  console.log("Seeding plans...");

  const [monthlyPlan, yearlyPlan] = await db
    .insert(plans)
    .values([
      {
        code: "monthly",
        name: "Monthly",
        description: "Full access, billed every month. Cancel any time.",
        priceMinor: 49_900, // ₹499.00
        currency: CURRENCY,
        interval: "month",
        prizePoolShareBps: DEFAULT_PRIZE_POOL_SHARE_BPS,
        sortOrder: 1,
      },
      {
        code: "yearly",
        name: "Yearly",
        // Two months free versus monthly — the discount the PRD asks for (§04).
        description: "Full access for a year. Two months free compared to monthly.",
        priceMinor: 499_000, // ₹4,990.00
        currency: CURRENCY,
        interval: "year",
        prizePoolShareBps: DEFAULT_PRIZE_POOL_SHARE_BPS,
        sortOrder: 2,
      },
    ])
    .returning();

  // --- Charities -----------------------------------------------------------

  console.log("Seeding charities...");

  const charityRows = await db
    .insert(charities)
    .values(
      CHARITY_SEED.map((c, index) => ({
        slug: c.slug,
        name: c.name,
        tagline: c.tagline,
        summary: c.summary,
        description: c.description,
        category: c.category,
        location: c.location,
        isFeatured: c.isFeatured,
        sortOrder: index,
      })),
    )
    .returning();

  // A few upcoming events, including the golf days the PRD calls out (§08.2).
  const now = new Date();
  const inDays = (days: number) =>
    new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  await db.insert(charityEvents).values([
    {
      charityId: charityRows[0].id,
      title: "Greenfield Charity Golf Day",
      description:
        "Eighteen holes, teams of four, all proceeds to the transport fund. Beginners welcome — half the field has never played.",
      startsAt: inDays(21),
      location: "Karnataka Golf Association, Bengaluru",
    },
    {
      charityId: charityRows[0].id,
      title: "Junior Open Day",
      description: "Free taster session for 8–14 year olds. Equipment provided.",
      startsAt: inDays(45),
      location: "Eagleton Resort, Bengaluru",
    },
    {
      charityId: charityRows[1].id,
      title: "Mind & Method Workshop",
      description:
        "A half-day on performance anxiety, run by the Fairway Mind clinical team.",
      startsAt: inDays(30),
      location: "Online",
    },
    {
      charityId: charityRows[3].id,
      title: "Adaptive Golf Open Day",
      description:
        "Adaptive carts and modified equipment available. Coaches on hand all day.",
      startsAt: inDays(14),
      location: "Willingdon Sports Club, Chennai",
    },
    {
      charityId: charityRows[5].id,
      title: "Second Swing Autumn Intake",
      description: "Twelve-week rehabilitation block. Referral or self-referral.",
      startsAt: inDays(60),
      location: "Delhi Golf Club",
    },
  ]);

  // --- Users ---------------------------------------------------------------

  console.log("Seeding users...");

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@digitalheroes.test";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345";
  const demoEmail = process.env.SEED_USER_EMAIL ?? "player@digitalheroes.test";
  const demoPassword = process.env.SEED_USER_PASSWORD ?? "Player@12345";

  // Hash the two shared demo passwords once and reuse for the generated
  // population: bcrypt at cost 12 is ~250ms, so hashing 24 users individually
  // would add pointless seconds to every seed run.
  const [adminHash, demoHash] = await Promise.all([
    hashPassword(adminPassword),
    hashPassword(demoPassword),
  ]);

  const userRows = await db
    .insert(users)
    .values([
      {
        email: adminEmail.toLowerCase(),
        passwordHash: adminHash,
        fullName: "Platform Administrator",
        role: "admin" as const,
        charityId: charityRows[0].id,
        charityPercent: CHARITY_MIN_PERCENT,
      },
      {
        email: demoEmail.toLowerCase(),
        passwordHash: demoHash,
        fullName: "Rahul Sharma",
        role: "user" as const,
        charityId: charityRows[0].id,
        // Above the floor, to demonstrate the voluntary increase (PRD §08.1).
        charityPercent: 25,
      },
      // Generated population so draws, leaderboards and reports have substance.
      ...Array.from({ length: 24 }, (_, i) => {
        const first = FIRST_NAMES[i % FIRST_NAMES.length];
        const last = pick(LAST_NAMES);

        return {
          email: `${first.toLowerCase()}.${last.toLowerCase()}${i}@digitalheroes.test`,
          passwordHash: demoHash,
          fullName: `${first} ${last}`,
          role: "user" as const,
          charityId: pick(charityRows).id,
          charityPercent: pick([10, 10, 10, 15, 20, 25, 40] as const),
        };
      }),
    ])
    .returning();

  const [adminUser, demoUser] = userRows;
  const playerUsers = userRows.filter((u) => u.role === "user");

  // --- Subscriptions and payments -----------------------------------------

  console.log("Seeding subscriptions and payment history...");

  const thisPeriod = currentPeriodKey();
  const periodKeys = [
    shiftPeriodKey(thisPeriod, -2),
    shiftPeriodKey(thisPeriod, -1),
    thisPeriod,
  ];

  const subscriptionValues: (typeof subscriptions.$inferInsert)[] = [];
  const paymentValues: (typeof payments.$inferInsert)[] = [];

  for (const user of playerUsers) {
    // A realistic mix: most active, a few lapsed or cancelled, so access
    // control and the admin panel have non-happy-path rows to display.
    const roll = rng();
    const status =
      user.id === demoUser.id
        ? ("active" as const)
        : roll < 0.78
          ? ("active" as const)
          : roll < 0.9
            ? ("canceled" as const)
            : ("expired" as const);

    const plan = rng() < 0.7 ? monthlyPlan : yearlyPlan;

    const periodStartDate = new Date(now.getTime() - randomInt(1, 25) * 86_400_000);
    const periodEndDate = new Date(
      periodStartDate.getTime() +
        (plan.interval === "year" ? 365 : 30) * 86_400_000,
    );

    const subscriptionId = crypto.randomUUID();

    subscriptionValues.push({
      id: subscriptionId,
      userId: user.id,
      planId: plan.id,
      status,
      // Placeholder identifiers: seeded subscriptions never existed in Stripe.
      // Real ones are created by Checkout in Phase 2.
      stripeCustomerId: `cus_seed_${user.id.slice(0, 8)}`,
      stripeSubscriptionId: `sub_seed_${user.id.slice(0, 8)}`,
      currentPeriodStart: periodStartDate,
      currentPeriodEnd:
        status === "expired"
          ? new Date(now.getTime() - 3 * 86_400_000)
          : periodEndDate,
      cancelAtPeriodEnd: status === "canceled",
      canceledAt: status === "canceled" ? new Date() : null,
    });

    if (status === "expired") continue;

    // One payment per period the subscriber has been active for. This is what
    // funds the prize pool the draw engine will later divide.
    const paidPeriods = plan.interval === "year" ? periodKeys.slice(-1) : periodKeys;

    for (const periodKey of paidPeriods) {
      const split = splitSubscriptionPayment({
        amountMinor: plan.priceMinor,
        charityPercent: user.charityPercent,
        prizePoolShareBps: plan.prizePoolShareBps,
      });

      paymentValues.push({
        userId: user.id,
        subscriptionId,
        stripeInvoiceId: `in_seed_${user.id.slice(0, 8)}_${periodKey}`,
        amountMinor: split.amountMinor,
        currency: CURRENCY,
        status: "succeeded",
        periodKey,
        charityId: user.charityId,
        charityPercent: split.charityPercent,
        charityAmountMinor: split.charityAmountMinor,
        prizePoolShareBps: plan.prizePoolShareBps,
        prizePoolAmountMinor: split.prizePoolAmountMinor,
        platformAmountMinor: split.platformAmountMinor,
        paidAt: periodStartDate,
      });
    }
  }

  await db.insert(subscriptions).values(subscriptionValues);
  await db.insert(payments).values(paymentValues);

  // --- Scores --------------------------------------------------------------

  console.log("Seeding scores...");

  const scoreValues: (typeof scores.$inferInsert)[] = [];

  for (const user of playerUsers) {
    // Most players have a full set of five (and so are draw-eligible); a few
    // are short, which is exactly the edge case the entry rules must handle.
    const count = rng() < 0.85 ? SCORES_RETAINED : randomInt(1, 4);

    // Distinct dates: the (user_id, played_on) unique constraint is real, and
    // the seed must not be the first thing to violate it.
    const dayOffsets = new Set<number>();
    while (dayOffsets.size < count) {
      dayOffsets.add(randomInt(1, 90));
    }

    for (const offset of dayOffsets) {
      const playedOn = new Date(now.getTime() - offset * 86_400_000)
        .toISOString()
        .slice(0, 10);

      scoreValues.push({
        userId: user.id,
        playedOn,
        // Weighted toward a realistic club Stableford range (mid-20s to mid-30s)
        // rather than uniform across 1–45, so the algorithmic draw mode has a
        // genuine frequency distribution to weight against.
        points: Math.min(
          SCORE_MAX,
          Math.max(SCORE_MIN, Math.round(29 + (rng() + rng() + rng() - 1.5) * 9)),
        ),
        courseName: pick(COURSE_NAMES),
      });
    }
  }

  await db.insert(scores).values(scoreValues);

  // --- Summary -------------------------------------------------------------

  const poolThisPeriod = paymentValues
    .filter((p) => p.periodKey === thisPeriod)
    .reduce((sum, p) => sum + p.prizePoolAmountMinor, 0);

  const charityTotal = paymentValues.reduce((sum, p) => sum + p.charityAmountMinor, 0);

  console.log(`
Seed complete.

  Charities            ${charityRows.length}
  Plans                2 (monthly ₹499, yearly ₹4,990)
  Users                ${userRows.length} (1 admin, ${playerUsers.length} players)
  Subscriptions        ${subscriptionValues.length}
  Payments             ${paymentValues.length}
  Scores               ${scoreValues.length}

  Prize pool (${thisPeriod})  ₹${(poolThisPeriod / 100).toLocaleString("en-IN")}
  Charity raised (all)  ₹${(charityTotal / 100).toLocaleString("en-IN")}

Sign in with:
  Admin   ${adminEmail} / ${adminPassword}
  Player  ${demoEmail} / ${demoPassword}
`);

  // Silence unused-variable lint for the admin row, which exists for clarity.
  void adminUser;
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

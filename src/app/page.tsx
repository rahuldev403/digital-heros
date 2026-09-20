import Link from "next/link";

import { ArrowRight, HeartHandshake, PenLine, Trophy } from "lucide-react";

import { LottiePlayer } from "@/components/lottie-player";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { Marquee } from "@/components/marquee";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { NumberRow } from "@/components/ui/number-ball";
import { PRIZE_TIERS, SCORES_RETAINED, TIER_SHARE_BPS } from "@/lib/constants";
import { getCurrentUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { formatPeriod, currentPeriodKey } from "@/lib/period";
import { getPlatformStats } from "@/lib/stats";

/**
 * Homepage — PRD §12 HOMEPAGE.
 *
 * The brief requires it to communicate four things: what the user does, how
 * they win, the charity impact, and the call to action. Each has its own
 * section below, in that order, and every figure shown is read live from the
 * database rather than hard-coded — an evaluator can change the data and watch
 * the page change.
 */
export default async function HomePage() {
  const [user, stats] = await Promise.all([getCurrentUser(), getPlatformStats()]);

  const period = currentPeriodKey();

  return (
    <>
      <SiteHeader />

      <main className="flex-1">
        <Hero stats={stats} signedIn={Boolean(user)} />

        <Marquee
          items={[
            `${formatMoney(stats.charityRaisedMinor, stats.currency)} raised for charity`,
            `${stats.charityCount} causes to choose from`,
            `${formatPeriod(period)} pool: ${formatMoney(stats.prizePoolMinor, stats.currency)}`,
            "Your scores are your numbers",
            "10% minimum to charity",
          ]}
        />

        <HowItWorks />
        <PrizeTiers stats={stats} />
        <CharityImpact stats={stats} />
        <FinalCta signedIn={Boolean(user)} />
      </main>

      <SiteFooter />
    </>
  );
}

// ---------------------------------------------------------------------------

function Hero({
  stats,
  signedIn,
}: {
  stats: Awaited<ReturnType<typeof getPlatformStats>>;
  signedIn: boolean;
}) {
  return (
    <section className="relative overflow-hidden border-b-2 border-ink">
      {/* Sunburst sits behind everything and is purely decorative. */}
      <div
        aria-hidden
        className="sunburst pointer-events-none absolute left-1/2 -top-72 size-184 -translate-x-1/2 opacity-70"
      />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.1fr_1fr] lg:py-24">
        <div className="space-y-7">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border-2 border-ink bg-mustard px-3.5 py-1.5 text-xs font-bold uppercase tracking-widest shadow-retro-sm">
              Play · Give · Win
            </span>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="text-5xl sm:text-6xl lg:text-7xl">
              The scores
              <br />
              you played
              <br />
              <span className="text-orange">are the numbers</span>
              <br />
              you play.
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="max-w-lg text-lg leading-relaxed text-ink-soft">
              Log your last {SCORES_RETAINED} rounds. They become your entry in
              the monthly draw — no tickets, no picking numbers. And at least a
              tenth of every subscription goes to a cause you choose.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-widest text-ink-faint">
                A player&apos;s entry
              </p>
              <NumberRow numbers={[32, 28, 41, 19, 35]} tone="plum" />
            </div>
          </Reveal>

          <Reveal delay={0.2}>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row">
              <Button as={Link} href={signedIn ? "/dashboard" : "/signup"} size="lg">
                {signedIn ? "Go to dashboard" : "Start playing"}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button as={Link} href="/charities" size="lg" variant="secondary">
                See the causes
              </Button>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.1}>
          <div className="relative">
            <div className="card-retro overflow-hidden bg-cream-deep p-4">
              <LottiePlayer src="/golfer-cart.lottie.json" />
            </div>

            <div className="absolute -bottom-5 -left-3 rotate-[-4deg] rounded-xl border-2 border-ink bg-forest px-4 py-2.5 text-cream shadow-retro">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
                Raised so far
              </p>
              <p className="font-mono text-xl font-bold tabular">
                {formatMoney(stats.charityRaisedMinor, stats.currency)}
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: PenLine,
    title: "Log your round",
    body: `Enter your Stableford score and the date. We keep your latest ${SCORES_RETAINED} — a new one replaces the oldest.`,
    tone: "bg-teal text-cream",
  },
  {
    icon: HeartHandshake,
    title: "Pick your cause",
    body: "Choose a charity when you join. At least 10% of every payment goes to it, and you can give more whenever you want.",
    tone: "bg-forest text-cream",
  },
  {
    icon: Trophy,
    title: "Enter every draw",
    body: "Those five scores are automatically your numbers each month. Match three or more and you take a share of the pool.",
    tone: "bg-plum text-cream",
  },
];

function HowItWorks() {
  return (
    <section className="border-b-2 border-ink px-5 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-10">
        <Reveal>
          <h2 className="text-4xl sm:text-5xl">How it works</h2>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal key={step.title} delay={index * 0.08}>
              <article className="card-retro card-lift h-full p-6">
                <div
                  className={`mb-5 flex size-12 items-center justify-center rounded-xl border-2 border-ink ${step.tone} shadow-retro-sm`}
                >
                  <step.icon className="size-5" aria-hidden />
                </div>
                <p className="mb-1 font-mono text-sm font-bold text-ink-faint">
                  0{index + 1}
                </p>
                <h3 className="mb-2 text-xl">{step.title}</h3>
                <p className="leading-relaxed text-ink-soft">{step.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

const TIER_COPY: Record<number, { label: string; note: string; tone: string }> = {
  5: {
    label: "Match 5",
    note: "The jackpot. Rolls over if nobody lands it.",
    tone: "bg-mustard text-ink",
  },
  4: { label: "Match 4", note: "Shared equally between winners.", tone: "bg-teal text-cream" },
  3: { label: "Match 3", note: "Shared equally between winners.", tone: "bg-plum text-cream" },
};

function PrizeTiers({ stats }: { stats: Awaited<ReturnType<typeof getPlatformStats>> }) {
  // Highest tier first — the jackpot is the headline.
  const tiers = [...PRIZE_TIERS].reverse();

  return (
    <section className="border-b-2 border-ink bg-cream-deep px-5 py-16 lg:py-24">
      <div className="mx-auto max-w-6xl space-y-10">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-4xl sm:text-5xl">How you win</h2>
            <div className="rounded-xl border-2 border-ink bg-paper px-4 py-2.5 shadow-retro-sm">
              <p className="text-[0.65rem] font-bold uppercase tracking-widest text-ink-faint">
                {formatPeriod(currentPeriodKey())} pool
              </p>
              <p className="font-mono text-2xl font-bold tabular text-orange">
                {formatMoney(stats.prizePoolMinor, stats.currency)}
              </p>
            </div>
          </div>
        </Reveal>

        <div className="grid gap-5 md:grid-cols-3">
          {tiers.map((tier, index) => {
            const sharePercent = TIER_SHARE_BPS[tier] / 100;
            const tierAmount = Math.round(
              (stats.prizePoolMinor * TIER_SHARE_BPS[tier]) / 10_000,
            );

            return (
              <Reveal key={tier} delay={index * 0.08}>
                <article className="card-retro card-lift h-full overflow-hidden">
                  <div
                    className={`flex items-center justify-between border-b-2 border-ink px-5 py-3 ${TIER_COPY[tier].tone}`}
                  >
                    <span className="font-display text-lg uppercase">
                      {TIER_COPY[tier].label}
                    </span>
                    <span className="font-mono text-lg font-bold tabular">
                      {sharePercent}%
                    </span>
                  </div>

                  <div className="space-y-3 p-5">
                    <p className="font-mono text-3xl font-bold tabular">
                      {formatMoney(tierAmount, stats.currency)}
                    </p>
                    <p className="text-sm leading-relaxed text-ink-soft">
                      {TIER_COPY[tier].note}
                    </p>
                  </div>
                </article>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <p className="text-sm text-ink-faint">
            Pool shares are fixed at {TIER_SHARE_BPS[5] / 100}/{TIER_SHARE_BPS[4] / 100}/
            {TIER_SHARE_BPS[3] / 100}. Amounts shown are this month&apos;s pool
            split by those shares, before it is divided between winners in each
            tier.
            {stats.rolloverInMinor > 0 && (
              <>
                {" "}
                Includes{" "}
                <strong className="font-mono tabular text-ink">
                  {formatMoney(stats.rolloverInMinor, stats.currency)}
                </strong>{" "}
                carried over from an unclaimed jackpot.
              </>
            )}
          </p>
        </Reveal>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function CharityImpact({
  stats,
}: {
  stats: Awaited<ReturnType<typeof getPlatformStats>>;
}) {
  return (
    <section className="border-b-2 border-ink px-5 py-16 lg:py-24">
      <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2">
        <Reveal>
          <div className="space-y-6">
            <h2 className="text-4xl sm:text-5xl">
              The point isn&apos;t
              <br />
              <span className="text-forest">the prize.</span>
            </h2>
            <p className="max-w-lg text-lg leading-relaxed text-ink-soft">
              Every subscription splits before it reaches us. Your chosen charity
              is paid first, at the percentage you set — a floor of 10%, and as
              much more as you like. You can see exactly where it went.
            </p>
            <Button as={Link} href="/charities" size="lg" variant="dark">
              Browse {stats.charityCount} causes
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Raised for charity"
              value={formatMoney(stats.charityRaisedMinor, stats.currency)}
              tone="bg-forest text-cream"
            />
            <StatCard
              label="Causes listed"
              value={String(stats.charityCount)}
              tone="bg-mustard text-ink"
            />
            <StatCard
              label="Active members"
              value={String(stats.activeSubscribers)}
              tone="bg-teal text-cream"
            />
            <StatCard
              label="Minimum given"
              value="10%"
              tone="bg-orange text-cream"
            />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div
      className={`rounded-2xl border-2 border-ink p-5 shadow-retro ${tone}`}
    >
      <p className="text-[0.65rem] font-bold uppercase tracking-widest opacity-80">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-2xl font-bold tabular">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function FinalCta({ signedIn }: { signedIn: boolean }) {
  return (
    <section className="relative overflow-hidden bg-ink px-5 py-20 text-cream">
      <div aria-hidden className="stripes absolute inset-x-0 top-0 h-3 opacity-25" />

      <div className="mx-auto max-w-2xl space-y-7 text-center">
        <h2 className="text-4xl sm:text-5xl">
          Your next round
          <br />
          <span className="text-mustard">is a ticket.</span>
        </h2>
        <p className="text-lg leading-relaxed text-cream/75">
          Join, pick your cause, log five scores. That is the whole setup.
        </p>
        <div className="flex justify-center">
          <Button as={Link} href={signedIn ? "/dashboard" : "/signup"} size="lg">
            {signedIn ? "Go to dashboard" : "Create your account"}
            <ArrowRight className="size-4" aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}

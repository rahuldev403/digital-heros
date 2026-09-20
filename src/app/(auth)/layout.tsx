import Link from "next/link";

import { HeartHandshake, Sparkles, Trophy } from "lucide-react";

import { LottiePlayer } from "@/components/lottie-player";

/**
 * Shared shell for sign-in and sign-up.
 *
 * Split layout: the story on the left, the form on the right. The left panel
 * leads with charitable impact rather than sport (PRD §12), and is dropped
 * entirely below `lg` so a phone is not asked to scroll past marketing to reach
 * a password field.
 */

const PILLARS = [
  {
    icon: HeartHandshake,
    title: "Your subscription gives",
    body: "At least 10% of every payment goes to a cause you pick. Give more whenever you want.",
  },
  {
    icon: Trophy,
    title: "Your scores are your numbers",
    body: "The last five rounds you logged are your entry. No tickets, no picking numbers.",
  },
  {
    icon: Sparkles,
    title: "Play, give, win",
    body: "Match three, four or five for a share of the pool. The jackpot rolls over until someone lands it.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r-2 border-ink bg-forest p-12 text-cream lg:flex">
        <div
          aria-hidden
          className="sunburst pointer-events-none absolute -left-40 -top-40 size-136 opacity-25"
        />

        <Link
          href="/"
          className="relative font-display text-xl uppercase tracking-tight"
        >
          digital<span className="text-mustard">.</span>heroes
        </Link>

        <div className="relative max-w-md space-y-8">
          <h1 className="text-4xl text-balance">
            Golf that gives
            <span className="block text-mustard">something back.</span>
          </h1>

          <ul className="space-y-5">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-mustard text-ink">
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="space-y-0.5">
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm leading-relaxed text-cream/75">{body}</p>
                </div>
              </li>
            ))}
          </ul>

          <LottiePlayer src="/golfer-cart.lottie.json" className="max-w-xs opacity-95" />
        </div>

        <p className="relative text-xs text-cream/55">
          Digital Heroes · a golf performance and charity draw platform
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <Link
          href="/"
          className="mb-10 font-display text-xl uppercase tracking-tight lg:hidden"
        >
          digital<span className="text-orange">.</span>heroes
        </Link>

        <div className="w-full max-w-md lg:mx-auto">{children}</div>
      </main>
    </div>
  );
}

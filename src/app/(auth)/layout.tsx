import Link from "next/link";

import { HeartHandshake, Sparkles, Trophy } from "lucide-react";

/**
 * Shared shell for sign-in and sign-up.
 *
 * Split layout: the story on the left, the form on the right. The left panel
 * leads with charitable impact rather than golf (PRD §12 — "emotion-driven,
 * leading with charitable impact, not sport"), and collapses away entirely on
 * mobile so a small screen is not asked to scroll past marketing to reach a
 * password field.
 */

const PILLARS = [
  {
    icon: HeartHandshake,
    title: "Your subscription gives",
    body: "At least 10% of every payment goes to a cause you pick. You can give more whenever you want.",
  },
  {
    icon: Trophy,
    title: "Your scores are your numbers",
    body: "The last five rounds you logged are your entry in the monthly draw. No tickets to buy, no numbers to pick.",
  },
  {
    icon: Sparkles,
    title: "Play, give, win",
    body: "Match three, four or five and you take a share of the pool. The jackpot rolls over until somebody lands it.",
  },
];

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      {/* Story panel — hidden on small screens. */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-line bg-surface p-12">
        <div className="glow-mint pointer-events-none absolute inset-x-0 -top-40 h-96" />

        <Link
          href="/"
          className="relative text-lg font-semibold tracking-tight text-ink"
        >
          digital<span className="text-mint">.</span>heroes
        </Link>

        <div className="relative max-w-md space-y-10">
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-balance">
            Golf that gives
            <span className="block font-display italic text-mint">
              something back.
            </span>
          </h1>

          <ul className="space-y-6">
            {PILLARS.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-mint/10 text-mint">
                  <Icon className="size-4.5" aria-hidden />
                </span>
                <div className="space-y-1">
                  <p className="font-medium text-ink">{title}</p>
                  <p className="text-sm leading-relaxed text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-faint">
          Digital Heroes · a golf performance and charity draw platform
        </p>
      </aside>

      {/* Form panel. */}
      <main className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <Link
          href="/"
          className="mb-10 text-lg font-semibold tracking-tight text-ink lg:hidden"
        >
          digital<span className="text-mint">.</span>heroes
        </Link>

        <div className="w-full max-w-md lg:mx-auto">{children}</div>
      </main>
    </div>
  );
}

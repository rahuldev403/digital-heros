import type { Metadata } from "next";
import { Archivo, Archivo_Black, Space_Mono } from "next/font/google";

import "./globals.css";

/**
 * Type system.
 *
 * One superfamily does the work: Archivo for everything readable, Archivo
 * Black for poster headlines. Sharing a skeleton between body and display is
 * what keeps a loud retro layout from tipping into novelty — the headlines are
 * emphatic, not a different personality.
 *
 * Space Mono carries every number that matters: draw numbers, Stableford
 * points, prize amounts. A retro monospace makes a lottery number look like a
 * lottery number, and tabular figures keep columns aligned.
 */
const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const archivoBlack = Archivo_Black({
  variable: "--font-archivo-black",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Digital Heroes · Golf that gives something back",
    template: "%s · Digital Heroes",
  },
  description:
    "Log your rounds, enter the monthly draw with the scores you actually played, and send part of every subscription to a cause you choose.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoBlack.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="grain min-h-full flex flex-col bg-cream text-ink">
        {children}
      </body>
    </html>
  );
}

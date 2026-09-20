import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display face, used only for the italic phrase in headlines.
 *
 * The PRD's own document pairs a geometric sans with a high-contrast serif
 * italic; borrowing that pairing keeps the product recognisably part of the
 * same brand, and the serif does the emotional work that a golf photograph
 * would otherwise be asked to do (PRD §12 AVOID).
 */
const instrumentSerif = Instrument_Serif({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
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
      className={`${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-canvas text-ink">{children}</body>
    </html>
  );
}

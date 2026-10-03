import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { SiteHeader } from "@/components/shell/site-header";
import { BASE_PATH, SITE_ORIGIN } from "@/lib/deployment";

import "./globals.css";

/**
 * Inter for prose and display, JetBrains Mono for every technical label.
 * The pairing is deliberate: the mono face is what makes the diagrams read as
 * engineering rather than as marketing.
 */
const sans = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atlas-sans",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atlas-mono",
});

/**
 * Canonical origin for metadata.
 *
 * This is the *public* origin — the portfolio, not the Vercel deployment — so
 * that `og:url` and the canonical link point at the address a visitor actually
 * sees. The path prefix is applied per-page by Next, which already knows about
 * `basePath`.
 *
 * Both values come from `src/lib/deployment.ts`, so the domain is never
 * hard-coded in a component.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "Protocol Atlas — How data actually moves",
    template: "%s · Protocol Atlas",
  },
  description:
    "An interactive visual guide to computer networking and communication protocols: TCP, UDP, HTTP, HTTPS, I²C and CAN. Trace a real web request end to end, follow messages through a robot's buses, and see how each protocol works from the inside.",
  applicationName: "Protocol Atlas",
  authors: [{ name: "Shriful" }],
  keywords: [
    "networking",
    "protocols",
    "TCP",
    "UDP",
    "HTTP",
    "HTTPS",
    "TLS",
    "I2C",
    "CAN bus",
    "embedded systems",
    "interactive",
  ],
  openGraph: {
    type: "website",
    title: "Protocol Atlas — How data actually moves",
    description:
      "A presentation-grade interactive guide to TCP, UDP, HTTP, HTTPS, I²C and CAN — with animated packet flows, header inspectors and full request traces.",
    siteName: "Protocol Atlas",
  },
  robots: { index: true, follow: true },
  /**
   * Declare the public address explicitly. Behind a reverse proxy the origin
   * only ever sees the stripped path, so without this a crawler could
   * canonicalise the app to the Vercel hostname.
   */
  alternates: {
    canonical: `${SITE_ORIGIN}${BASE_PATH || "/"}`,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d0f12",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-void font-sans antialiased">
        {/* Skip link — the orbit has many focusable nodes, so keyboard users
            need a way past them. */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-ink focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-void"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">{children}</main>
      </body>
    </html>
  );
}

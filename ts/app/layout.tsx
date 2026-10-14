import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "blitzyxsc — Auth-free X/Twitter scraping API",
    template: "%s • blitzyxsc",
  },
  description:
    "Auth-free X/Twitter scraping API by Blitz (@blitzlabx). Multi-provider router, CORS-enabled, Vercel-ready. TypeScript / Next.js mirror of the Python FastAPI service.",
  applicationName: "blitzyxsc",
  authors: [{ name: "Blitz", url: "https://x.com/blitzlabx" }],
  keywords: [
    "twitter",
    "x",
    "scraper",
    "fxtwitter",
    "nitter",
    "syndication",
    "blitzyxsc",
    "blitzlabx",
  ],
  openGraph: {
    title: "blitzyxsc",
    description:
      "Auth-free X/Twitter scraping API by @blitzlabx. Multi-provider, CORS-enabled, serverless-ready.",
    url: "https://x.com/blitzlabx",
    siteName: "blitzyxsc",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    creator: "@blitzlabx",
    title: "blitzyxsc",
    description:
      "Auth-free X/Twitter scraping API by @blitzlabx. Multi-provider, CORS-enabled, serverless-ready.",
  },
  icons: {
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Cdefs%3E%3ClinearGradient id='g' x1='0' y1='0' x2='1' y2='1'%3E%3Cstop offset='0' stop-color='%231DA1F2'/%3E%3Cstop offset='1' stop-color='%238B5CF6'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect width='64' height='64' rx='14' fill='%230a0a0a'/%3E%3Ctext x='32' y='42' font-family='sans-serif' font-size='34' font-weight='700' text-anchor='middle' fill='url(%23g)'%3Eb%3C/text%3E%3C/svg%3E",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

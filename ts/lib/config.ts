/**
 * blitzyxsc configuration.
 *
 * Mirrors the Python `blitzyxsc_api/config.py` Settings class. All values
 * come from environment variables prefixed `BLITZYXSC_` and fall back to
 * the same defaults the FastAPI service ships with — so the two deployments
 * are interchangeable.
 */
export const BRAND = "blitzyxsc";
export const VERSION = "1.0.0";
export const AUTHOR = "Blitz <blitzlabx>";
export const AUTHOR_HANDLE = "blitzlabx";
export const AUTHOR_URL = "https://x.com/blitzlabx";

function splitCsv(v: string | undefined, fallback: string[]): string[] {
  if (!v) return fallback;
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

function num(v: string | undefined, fallback: number): number {
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export interface Settings {
  brand: string;
  author: string;
  corsOrigins: string[];
  providerOrder: string[];
  syndicationTimeout: number;
  nitterTimeout: number;
  composableTimeout: number;
  rssTimeout: number;
  nitterInstances: string[];
  composableBaseUrl: string;
  syndicationBaseUrl: string;
  cacheTtlSeconds: number;
  defaultPageSize: number;
  maxPageSize: number;
  userAgent: string;
}

const DEFAULT_NITTER_INSTANCES = [
  "https://nitter.meowing.monster",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.cz",
  "https://nitter.woodland.cafe",
  "https://nitter.1d4.us",
  "https://nitter.kavin.rocks",
  "https://nitter.unixfox.eu",
];

const DEFAULT_PROVIDER_ORDER = ["composable", "syndication", "nitter", "rss"];

export const settings: Settings = {
  brand: process.env.BLITZYXSC_BRAND || BRAND,
  author: process.env.BLITZYXSC_AUTHOR || AUTHOR,
  corsOrigins: splitCsv(process.env.BLITZYXSC_CORS_ORIGINS, ["*"]),
  providerOrder: splitCsv(
    process.env.BLITZYXSC_PROVIDER_ORDER,
    DEFAULT_PROVIDER_ORDER,
  ),
  syndicationTimeout: num(process.env.BLITZYXSC_SYNDICATION_TIMEOUT, 10),
  nitterTimeout: num(process.env.BLITZYXSC_NITTER_TIMEOUT, 15),
  composableTimeout: num(process.env.BLITZYXSC_COMPOSABLE_TIMEOUT, 15),
  rssTimeout: num(process.env.BLITZYXSC_RSS_TIMEOUT, 15),
  nitterInstances: splitCsv(
    process.env.BLITZYXSC_NITTER_INSTANCES,
    DEFAULT_NITTER_INSTANCES,
  ),
  composableBaseUrl:
    process.env.BLITZYXSC_COMPOSABLE_BASE_URL || "https://api.fxtwitter.com",
  syndicationBaseUrl:
    process.env.BLITZYXSC_SYNDICATION_BASE_URL ||
    "https://cdn.syndication.twimg.com",
  cacheTtlSeconds: num(process.env.BLITZYXSC_CACHE_TTL_SECONDS, 60),
  defaultPageSize: num(process.env.BLITZYXSC_DEFAULT_PAGE_SIZE, 20),
  maxPageSize: num(process.env.BLITZYXSC_MAX_PAGE_SIZE, 100),
  userAgent:
    process.env.BLITZYXSC_USER_AGENT ||
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

/** Per-request helper used by every API route to attach branding + CORS headers. */
export function brandHeaders(): HeadersInit {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "X-Powered-By": `${settings.brand} ${VERSION}`,
    "X-Author": AUTHOR_HANDLE,
  };
}

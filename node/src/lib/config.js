/**
 * blitzyxsc-express configuration.
 *
 * Mirrors the Python `blitzyxsc_api/config.py` Settings class. Every value
 * comes from an environment variable prefixed `BLITZYXSC_` and falls back to
 * the same defaults the FastAPI service ships with, so the Node.js and
 * Python deployments are interchangeable.
 *
 * Branding constants are exported separately so the server can attach them
 * to every response without re-reading process.env.
 */

export const BRAND = "blitzyxsc";
export const VERSION = "1.0.0";
export const AUTHOR = "Blitz <blitzlabx>";
export const AUTHOR_HANDLE = "blitzlabx";
export const AUTHOR_URL = "https://x.com/blitzlabx";

/**
 * Parse a CSV env var into a string array, falling back to `fallback`
 * when the var is unset or empty.
 *
 * @param {string | undefined} v
 * @param {string[]} fallback
 * @returns {string[]}
 */
function splitCsv(v, fallback) {
  if (!v) return fallback;
  const parts = v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : fallback;
}

/**
 * Parse a number env var, falling back to `fallback` when unset / invalid.
 *
 * @param {string | undefined} v
 * @param {number} fallback
 * @returns {number}
 */
function num(v, fallback) {
  if (v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export const DEFAULT_NITTER_INSTANCES = [
  "https://nitter.meowing.monster",
  "https://nitter.poast.org",
  "https://nitter.privacydev.net",
  "https://nitter.cz",
  "https://nitter.woodland.cafe",
  "https://nitter.1d4.us",
  "https://nitter.kavin.rocks",
  "https://nitter.unixfox.eu",
];

export const DEFAULT_PROVIDER_ORDER = ["composable", "syndication", "nitter", "rss"];

export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * @typedef {Object} Settings
 * @property {string} brand
 * @property {string} author
 * @property {string} host
 * @property {number} port
 * @property {string[]} corsOrigins
 * @property {string[]} providerOrder
 * @property {number} syndicationTimeout
 * @property {number} nitterTimeout
 * @property {number} composableTimeout
 * @property {number} rssTimeout
 * @property {string[]} nitterInstances
 * @property {string} composableBaseUrl
 * @property {string} syndicationBaseUrl
 * @property {number} cacheTtlSeconds
 * @property {number} defaultPageSize
 * @property {number} maxPageSize
 * @property {string} userAgent
 */

/** @type {Settings} */
export const settings = {
  brand: process.env.BLITZYXSC_BRAND || BRAND,
  author: process.env.BLITZYXSC_AUTHOR || AUTHOR,
  host: process.env.BLITZYXSC_HOST || "0.0.0.0",
  port: num(process.env.BLITZYXSC_PORT, 3001),
  corsOrigins: splitCsv(process.env.BLITZYXSC_CORS_ORIGINS, ["*"]),
  providerOrder: splitCsv(process.env.BLITZYXSC_PROVIDER_ORDER, DEFAULT_PROVIDER_ORDER),
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
    process.env.BLITZYXSC_SYNDICATION_BASE_URL || "https://cdn.syndication.twimg.com",
  cacheTtlSeconds: num(process.env.BLITZYXSC_CACHE_TTL_SECONDS, 60),
  defaultPageSize: num(process.env.BLITZYXSC_DEFAULT_PAGE_SIZE, 20),
  maxPageSize: num(process.env.BLITZYXSC_MAX_PAGE_SIZE, 100),
  userAgent: process.env.BLITZYXSC_USER_AGENT || DEFAULT_USER_AGENT,
};

/**
 * Express middleware that attaches blitzyxsc branding headers to every
 * response. Mirrors the FastAPI `add_branding_headers` middleware in
 * `blitzyxsc_api/main.py`.
 *
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function brandingMiddleware(_req, res, next) {
  res.setHeader("X-Powered-By", `${BRAND} ${VERSION}`);
  res.setHeader("X-Author", AUTHOR_HANDLE);
  res.setHeader("X-Author-URL", AUTHOR_URL);
  next();
}

/**
 * Unified response schemas + builders for blitzyxsc-express.
 *
 * These builders mirror the Python Pydantic models in
 * `blitzyxsc_api/schemas/models.py` — the JSON shape returned by the
 * Express deployment is identical to the FastAPI deployment, so the two
 * are interchangeable client-side.
 *
 * Every builder accepts a `provider` ProviderInfo object that the registry
 * attaches on every call (name + ok + latency_ms).
 */

import { AUTHOR, BRAND, VERSION } from "./config.js";

/**
 * @typedef {Object} ProviderInfo
 * @property {string} name
 * @property {number | null} [latency_ms]
 * @property {boolean} ok
 */

/**
 * @typedef {Object} MediaItem
 * @property {string} type  photo | video | animated_gif
 * @property {string} url
 * @property {string | null} [alt]
 * @property {number | null} [width]
 * @property {number | null} [height]
 * @property {string | null} [thumbnail]
 * @property {number | null} [duration_ms]
 */

/**
 * @typedef {Object} TweetAuthor
 * @property {string | null} [id]
 * @property {string} username
 * @property {string | null} [display_name]
 * @property {string | null} [avatar]
 * @property {boolean | null} [verified]
 */

/**
 * @typedef {Object} Tweet
 * @property {string} id
 * @property {string} text
 * @property {TweetAuthor | null} [author]
 * @property {string | null} [created_at]
 * @property {string | null} [language]
 * @property {string | null} [source]
 * @property {number | null} [reply_count]
 * @property {number | null} [retweet_count]
 * @property {number | null} [like_count]
 * @property {number | null} [quote_count]
 * @property {number | null} [bookmark_count]
 * @property {number | null} [view_count]
 * @property {MediaItem[]} media
 * @property {string[]} urls
 * @property {string[]} hashtags
 * @property {TweetAuthor[]} mentions
 * @property {string[]} cashtags
 * @property {string | null} [conversation_id]
 * @property {string | null} [in_reply_to]
 * @property {boolean | null} [is_quote]
 * @property {Tweet | null} [quoted_tweet]
 * @property {boolean | null} [is_retweet]
 * @property {Tweet | null} [retweeted_tweet]
 * @property {string | null} [url]
 * @property {boolean | null} [sensitive]
 */

/**
 * @typedef {Object} Profile
 * @property {string | null} [id]
 * @property {string} username
 * @property {string | null} [display_name]
 * @property {string | null} [bio]
 * @property {string | null} [location]
 * @property {string | null} [website]
 * @property {string | null} [avatar]
 * @property {string | null} [banner]
 * @property {number | null} [followers]
 * @property {number | null} [following]
 * @property {number | null} [tweets_count]
 * @property {number | null} [likes_count]
 * @property {number | null} [listed_count]
 * @property {boolean | null} [verified]
 * @property {boolean | null} [protected]
 * @property {string | null} [joined_at]
 * @property {Tweet | null} [pinned_tweet]
 */

/**
 * Build a TweetResponse envelope.
 *
 * @param {Tweet} tweet
 * @param {ProviderInfo} info
 * @returns {{ data: Tweet, provider: ProviderInfo }}
 */
export function tweetResponse(tweet, info) {
  return { data: tweet, provider: info };
}

/**
 * Build a TweetListResponse envelope.
 *
 * @param {Tweet[]} tweets
 * @param {ProviderInfo} info
 * @param {number} [count]
 * @param {{ next_cursor?: string | null, previous_cursor?: string | null }} [extra]
 * @returns {{ data: Tweet[], provider: ProviderInfo, count: number, next_cursor: string | null, previous_cursor: string | null }}
 */
export function tweetListResponse(tweets, info, count, extra = {}) {
  return {
    data: tweets,
    provider: info,
    count: typeof count === "number" ? count : tweets.length,
    next_cursor: extra.next_cursor ?? null,
    previous_cursor: extra.previous_cursor ?? null,
  };
}

/**
 * Build a ProfileResponse envelope.
 *
 * @param {Profile} profile
 * @param {ProviderInfo} info
 * @returns {{ data: Profile, provider: ProviderInfo }}
 */
export function profileResponse(profile, info) {
  return { data: profile, provider: info };
}

/**
 * Build an ErrorResponse envelope.
 *
 * @param {string} message
 * @param {ProviderInfo | null} [info]
 * @param {unknown} [detail]
 * @returns {{ error: string, detail: unknown, provider: ProviderInfo | null }}
 */
export function errorResponse(message, info, detail) {
  return { error: message, detail: detail ?? null, provider: info ?? null };
}

/**
 * Build the /health response payload.
 *
 * @param {string[]} providers
 * @param {number} uptimeSeconds
 * @returns {{ status: string, brand: string, version: string, author: string, providers: string[], uptime_seconds: number }}
 */
export function healthResponse(providers, uptimeSeconds) {
  return {
    status: "ok",
    brand: BRAND,
    version: VERSION,
    author: AUTHOR,
    providers,
    uptime_seconds: uptimeSeconds,
  };
}

/**
 * Build the /providers list response.
 *
 * @param {{ name: string, priority: number }[]} providers
 * @param {string[]} order
 * @returns {{ providers: { name: string, priority: number }[], order: string[] }}
 */
export function providerListResponse(providers, order) {
  return { providers, order };
}

/**
 * Build the /providers/health live probe response.
 *
 * @param {Record<string, { healthy: boolean, error?: string }>} results
 * @returns {Record<string, { healthy: boolean, error?: string }>}
 */
export function providerHealthResponse(results) {
  return results;
}

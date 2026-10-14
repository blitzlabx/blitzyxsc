/**
 * blitzyxsc-express provider registry + multi-source router.
 *
 * Mirrors the Python `blitzyxsc_api/providers/` package and the TypeScript
 * port in `blitzyxsc/ts/lib/providers.ts`. The registry holds every provider
 * implementation and routes each request through them in priority order
 * (configurable via `BLITZYXSC_PROVIDER_ORDER`). The first provider that
 * returns a successful result wins; on failure the next is tried.
 *
 * Available providers (auth-free, public endpoints only):
 *   1. composableProvider — https://api.fxtwitter.com (fxtwitter JSON)
 *   2. syndicationProvider — https://cdn.syndication.twimg.com (Twitter embed CDN)
 *   3. nitterProvider — list of public Nitter mirrors (RSS / HTML)
 *   4. rssProvider — last-resort fallback (Nitter RSS + Twitter oEmbed)
 */

import { settings } from "../lib/config.js";
import {
  parseProfile,
  parseTweet,
  parseTwitterDate,
  toInt,
  toStr,
} from "../lib/parseFxtwitter.js";

/**
 * Raised when a provider cannot fulfill a request. The registry catches
 * these and tries the next provider in priority order.
 */
export class ProviderError extends Error {
  constructor(message) {
    super(message);
    this.name = "ProviderError";
  }
}

/**
 * Build a ProviderInfo object for the registry.
 *
 * @param {string} name
 * @param {boolean} ok
 * @param {number | null} latencyMs
 * @returns {{ name: string, ok: boolean, latency_ms: number | null }}
 */
function providerInfo(name, ok, latencyMs) {
  return { name, ok, latency_ms: latencyMs };
}

/**
 * Fetch helper that converts network/HTTP errors into ProviderError.
 *
 * @param {string} url
 * @param {{ headers?: Record<string, string>, timeoutMs?: number }} [opts]
 * @returns {Promise<Response>}
 */
async function fetchJson(url, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res;
  try {
    res = await fetch(url, {
      headers: opts.headers || {},
      signal: controller.signal,
      redirect: "follow",
    });
  } catch (e) {
    clearTimeout(timer);
    throw new ProviderError(`fetch ${url}: ${e?.message || String(e)}`);
  }
  clearTimeout(timer);
  if (res.status === 404) {
    throw new ProviderError(`${url}: not found (404)`);
  }
  if (!res.ok) {
    throw new ProviderError(`${url}: HTTP ${res.status} ${res.statusText}`);
  }
  return res;
}

// ============================================================================
// ComposableProvider — fxtwitter JSON (requires real User-Agent or 403)
// ============================================================================

/**
 * Composable X / fxtwitter provider. Uses the public fxtwitter JSON API.
 *
 * Field names follow fxtwitter's shape:
 *   - tweet:   `author` block, `replies/retweets/likes/quotes/views`
 *   - profile: `user` block, `followers/following/tweets/likes`
 */
export const composableProvider = {
  name: "composable",
  baseUrl: settings.composableBaseUrl,
  timeoutMs: settings.composableTimeout * 1000,

  /** @returns {Record<string, string>} */
  headers() {
    return {
      "User-Agent": settings.userAgent,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };
  },

  /**
   * @param {string} tweetId
   * @returns {Promise<import('../lib/schemas.js').Tweet>}
   */
  async getTweet(tweetId) {
    const res = await fetchJson(`${this.baseUrl}/status/${encodeURIComponent(tweetId)}`, {
      headers: this.headers(),
      timeoutMs: this.timeoutMs,
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object" || !data.tweet) {
      throw new ProviderError(`composable tweet ${tweetId}: empty`);
    }
    return parseTweet(data.tweet);
  },

  /**
   * @param {string} username
   * @returns {Promise<import('../lib/schemas.js').Profile>}
   */
  async getProfile(username) {
    const res = await fetchJson(`${this.baseUrl}/${encodeURIComponent(username)}`, {
      headers: this.headers(),
      timeoutMs: this.timeoutMs,
    });
    const data = await res.json().catch(() => null);
    if (!data || typeof data !== "object") {
      throw new ProviderError(`composable profile ${username}: empty`);
    }
    if (!data.user || Object.keys(data.user).length === 0) {
      throw new ProviderError(`composable profile ${username}: empty user block`);
    }
    return parseProfile(data, username);
  },

  // fxtwitter's user timeline endpoint is not consistently available; delegate
  // timeline / search / replies / quotes / mentions to the nitter fallback.
  async getUserTweets() {
    throw new ProviderError("composable does not support get_user_tweets");
  },
  async searchTweets() {
    throw new ProviderError("composable does not support search_tweets");
  },
  async getReplies() {
    throw new ProviderError("composable does not support get_replies");
  },
  async getQuotes() {
    throw new ProviderError("composable does not support get_quotes");
  },
  async getMentions() {
    throw new ProviderError("composable does not support get_mentions");
  },
  async getTrends() {
    throw new ProviderError("composable does not support get_trends");
  },
  async getMedia() {
    throw new ProviderError("composable does not support get_media");
  },

  /**
   * @returns {Promise<boolean>}
   */
  async health() {
    try {
      const r = await fetchJson(this.baseUrl, {
        headers: this.headers(),
        timeoutMs: 5000,
      });
      return r.status < 500;
    } catch {
      return false;
    }
  },
};

// ============================================================================
// SyndicationProvider — Twitter embed CDN (public, no auth)
// ============================================================================

/**
 * Twitter syndication provider — uses Twitter's public embed CDN
 * (`cdn.syndication.twimg.com`). The tweet-result endpoint serves embed
 * JSON for any public tweet without authentication.
 */
export const syndicationProvider = {
  name: "syndication",
  baseUrl: settings.syndicationBaseUrl,
  timeoutMs: settings.syndicationTimeout * 1000,

  headers() {
    return { "User-Agent": settings.userAgent, Accept: "application/json" };
  },

  /**
   * @param {string} tweetId
   * @returns {Promise<import('../lib/schemas.js').Tweet>}
   */
  async getTweet(tweetId) {
    const url = `${this.baseUrl}/tweet-result?id=${encodeURIComponent(tweetId)}&token=0`;
    const res = await fetchJson(url, {
      headers: this.headers(),
      timeoutMs: this.timeoutMs,
    });
    const raw = await res.json().catch(() => null);
    if (!raw || typeof raw !== "object") {
      throw new ProviderError(`syndication tweet ${tweetId}: empty response`);
    }
    return this._parseTweet(raw);
  },

  // syndication timeline endpoint is unreliable across regions; delegate to nitter.
  async getUserTweets() {
    throw new ProviderError("syndication does not support get_user_tweets");
  },
  // composable provider returns richer profile data with the same UA — registry
  // falls through to it automatically.
  async getProfile() {
    throw new ProviderError("syndication does not support get_profile");
  },
  async searchTweets() {
    throw new ProviderError("syndication does not support search_tweets");
  },
  async getReplies() {
    throw new ProviderError("syndication does not support get_replies");
  },
  async getQuotes() {
    throw new ProviderError("syndication does not support get_quotes");
  },
  async getMentions() {
    throw new ProviderError("syndication does not support get_mentions");
  },
  async getTrends() {
    throw new ProviderError("syndication does not support get_trends");
  },
  async getMedia() {
    throw new ProviderError("syndication does not support get_media");
  },

  async health() {
    try {
      const r = await fetchJson(`${this.baseUrl}/`, {
        headers: this.headers(),
        timeoutMs: 5000,
      });
      return r.status < 500;
    } catch {
      return false;
    }
  },

  /**
   * Parse the syndication tweet-result shape into the blitzyxsc Tweet.
   *
   * @param {Record<string, any>} raw
   * @returns {import('../lib/schemas.js').Tweet}
   * @private
   */
  _parseTweet(raw) {
    const user = raw.user || {};
    const author = {
      id: toStr(user.id_str ?? user.id ?? ""),
      username: toStr(user.screen_name ?? ""),
      display_name: typeof user.name === "string" ? user.name : null,
      avatar: typeof user.profile_image_url_https === "string" ? user.profile_image_url_https : null,
      verified: typeof user.verified === "boolean" ? user.verified : null,
    };

    /** @type {import('../lib/schemas.js').MediaItem[]} */
    const media = [];
    const mediaSource =
      (Array.isArray(raw.mediaDetails) && raw.mediaDetails) ||
      (raw.extended_entities && Array.isArray(raw.extended_entities.media)
        ? raw.extended_entities.media
        : []);
    for (const m of mediaSource) {
      if (!m || typeof m !== "object") continue;
      const originalInfo = m.original_info || {};
      media.push({
        type: typeof m.type === "string" ? m.type : "photo",
        url: (typeof m.media_url_https === "string" && m.media_url_https) ||
          (typeof m.media_url === "string" ? m.media_url : ""),
        alt: (typeof m.altText === "string" && m.altText) ||
          (typeof m.display_url === "string" ? m.display_url : null),
        width: toInt(originalInfo.width),
        height: toInt(originalInfo.height),
        thumbnail: typeof m.media_url_https === "string" ? m.media_url_https : null,
        duration_ms: toInt(m.duration_millis),
      });
    }

    const entities = raw.entities || {};
    const urls = Array.isArray(entities.urls)
      ? entities.urls.map((u) => toStr(u?.expanded_url ?? u?.url))
      : [];
    const hashtags = Array.isArray(entities.hashtags)
      ? entities.hashtags.map((h) => toStr(h?.text))
      : [];
    const mentions = Array.isArray(entities.user_mentions)
      ? entities.user_mentions.map((m) => ({
          username: toStr(m?.screen_name ?? ""),
          id: toStr(m?.id_str ?? "") || null,
        }))
      : [];
    const cashtags = Array.isArray(entities.symbols)
      ? entities.symbols.map((c) => toStr(c?.text))
      : [];

    let quoted = null;
    const quotedStatus = raw.quoted_status;
    if ((raw.quoted_status_id_str || quotedStatus) && quotedStatus) {
      quoted = this._parseTweet(quotedStatus);
    }

    const idStr = toStr(raw.id_str ?? raw.id ?? "");
    return {
      id: idStr,
      text: toStr(raw.text ?? raw.full_text ?? ""),
      author,
      created_at: parseTwitterDate(raw.created_at),
      language: typeof raw.lang === "string" ? raw.lang : null,
      source: typeof raw.source === "string" ? raw.source : null,
      reply_count: toInt(raw.reply_count),
      retweet_count: toInt(raw.retweet_count),
      like_count: toInt(raw.favorite_count),
      quote_count: toInt(raw.quote_count),
      bookmark_count: toInt(raw.bookmark_count),
      view_count: toInt(raw.view_count),
      media,
      urls,
      hashtags,
      mentions,
      cashtags,
      conversation_id: raw.conversation_id_str ? toStr(raw.conversation_id_str) : null,
      in_reply_to: raw.in_reply_to_status_id_str ? toStr(raw.in_reply_to_status_id_str) : null,
      is_quote: Boolean(quoted),
      quoted_tweet: quoted,
      is_retweet: null,
      retweeted_tweet: null,
      url: `https://x.com/${author.username}/status/${idStr}`,
      sensitive: typeof raw.possibly_sensitive === "boolean" ? raw.possibly_sensitive : null,
    };
  },
};

// ============================================================================
// NitterProvider — public mirrors, RSS + HTML scraping
// ============================================================================

const MONTHS_FULL = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Decode the common HTML entities that Nitter's RSS emits.
 *
 * @param {string} s
 * @returns {string}
 */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

/**
 * Return the first regex capture group from `s`, or null.
 *
 * @param {string} s
 * @param {RegExp} pattern
 * @returns {string | null}
 */
function extractFirst(s, pattern) {
  const m = pattern.exec(s);
  return m ? m[1].trim() : null;
}

/**
 * Return the first integer matched by `pattern` in `s`, or null.
 *
 * @param {string} s
 * @param {RegExp} pattern
 * @returns {number | null}
 */
function extractInt(s, pattern) {
  const m = pattern.exec(s);
  if (!m) return null;
  const cleaned = m[1]
    .replace(/,/g, "")
    .replace(/\./g, "")
    .replace("K", "000")
    .replace("M", "000000");
  const n = parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a Nitter RSS feed into Tweet objects.
 *
 * @param {string} xml
 * @param {string} base
 * @param {string} defaultUsername
 * @returns {import('../lib/schemas.js').Tweet[]}
 */
function parseRssFeed(xml, base, defaultUsername = "") {
  if (!xml) return [];
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/g;
  let im;
  while ((im = itemRe.exec(xml)) !== null) {
    const block = im[0];
    const title =
      (block.match(/<title[^>]*>([\s\S]*?)<\/title>/) || [])[1] || "";
    const link =
      (block.match(/<link[^>]*>([\s\S]*?)<\/link>/) || [])[1] ||
      (block.match(/<link[^>]*href="([^"]+)"/) || [])[1] ||
      "";
    const pub =
      (block.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) || [])[1] ||
      (block.match(/<published[^>]*>([\s\S]*?)<\/published>/) || [])[1] ||
      "";
    const desc =
      (block.match(/<description[^>]*>([\s\S]*?)<\/description>/) || [])[1] ||
      (block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/) || [])[1] ||
      "";

    let text = decodeEntities(title).trim();
    let authorPart = defaultUsername;
    const colonIdx = text.indexOf(": ");
    if (colonIdx > 0) {
      authorPart = text.slice(0, colonIdx);
      text = text.slice(colonIdx + 2);
    }

    let tid = "";
    const tidMatch = /\/status\/(\d+)/.exec(link);
    if (tidMatch) tid = tidMatch[1];

    const plain = decodeEntities(desc).replace(/<[^>]+>/g, "").trim() || text;

    /** @type {import('../lib/schemas.js').MediaItem[]} */
    const media = [];
    const imgRe = /<img[^>]+src="([^"]+)"/g;
    let mm;
    while ((mm = imgRe.exec(desc)) !== null) {
      media.push({ type: "photo", url: mm[1] });
    }

    items.push({
      id: tid,
      text: plain,
      author: { id: null, username: authorPart },
      created_at: parseTwitterDate(pub.trim()),
      language: null,
      source: null,
      reply_count: null,
      retweet_count: null,
      like_count: null,
      quote_count: null,
      bookmark_count: null,
      view_count: null,
      media,
      urls: [],
      hashtags: Array.from(text.matchAll(/#(\w+)/g)).map((m) => m[1]),
      mentions: Array.from(text.matchAll(/@(\w+)/g)).map((m) => ({
        username: m[1],
        id: null,
      })),
      cashtags: [],
      conversation_id: null,
      in_reply_to: null,
      is_quote: false,
      quoted_tweet: null,
      is_retweet: null,
      retweeted_tweet: null,
      url: link,
      sensitive: null,
    });
  }
  return items;
}

/**
 * Parse Nitter's HTML timeline page into Tweet objects.
 *
 * @param {string} html
 * @param {string} base
 * @param {boolean} skipFirst
 * @returns {import('../lib/schemas.js').Tweet[]}
 */
function parseHtmlTweets(html, base, skipFirst = false) {
  const tweets = [];
  const blockRe =
    /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<div class="timeline-item/g;
  const blocks = [];
  let bm;
  while ((bm = blockRe.exec(html + '<div class="timeline-item')) !== null) {
    blocks.push(bm[1]);
  }
  if (skipFirst && blocks.length) blocks.shift();

  for (const blk of blocks) {
    const tidM = /\/status\/(\d+)/.exec(blk);
    const tid = tidM ? tidM[1] : "";
    const userM =
      /href="\/([^/]+)"[^>]*>@/.exec(blk) || /username="([^"]+)"/.exec(blk);
    const username = userM ? userM[1] : "";
    const textM = /class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/.exec(blk);
    const text = textM ? decodeEntities(textM[1]).replace(/<[^>]+>/g, "").trim() : "";

    /** @type {import('../lib/schemas.js').MediaItem[]} */
    const media = [];
    const imgRe = /data-src="([^"]+)"|src="([^"]+\.(?:jpg|png|webp)[^"]*)"/g;
    let mm;
    while ((mm = imgRe.exec(blk)) !== null) {
      const url = mm[1] || mm[2];
      if (url) media.push({ type: "photo", url });
    }

    tweets.push({
      id: tid,
      text,
      author: { id: null, username },
      created_at: null,
      language: null,
      source: null,
      reply_count: null,
      retweet_count: null,
      like_count: null,
      quote_count: null,
      bookmark_count: null,
      view_count: null,
      media,
      urls: [],
      hashtags: Array.from(text.matchAll(/#(\w+)/g)).map((m) => m[1]),
      mentions: Array.from(text.matchAll(/@(\w+)/g)).map((m) => ({
        username: m[1],
        id: null,
      })),
      cashtags: [],
      conversation_id: null,
      in_reply_to: null,
      is_quote: false,
      quoted_tweet: null,
      is_retweet: null,
      retweeted_tweet: null,
      url: null,
      sensitive: null,
    });
  }
  return tweets;
}

/**
 * Nitter provider — public Nitter mirrors serve RSS / HTML for free.
 * Tries a list of instances in order; first that responds with 200 wins.
 */
export const nitterProvider = {
  name: "nitter",
  timeoutMs: settings.nitterTimeout * 1000,

  headers() {
    return { "User-Agent": settings.userAgent, Accept: "*/*" };
  },

  /**
   * Try every Nitter instance for `path`; first 200 with a body wins.
   *
   * @param {string} path
   * @returns {Promise<{ text: string, base: string }>}
   */
  async tryInstances(path) {
    let lastErr = null;
    for (const base of settings.nitterInstances) {
      const url = `${base}${path}`;
      try {
        const r = await fetchJson(url, {
          headers: this.headers(),
          timeoutMs: this.timeoutMs,
        });
        // fetchJson throws on non-ok; treat 200 as success
        if (r.status === 200) {
          const text = await r.text();
          if (text) return { text, base };
        }
      } catch (e) {
        lastErr = e;
      }
    }
    throw new ProviderError(
      `all Nitter instances failed for ${path}: ${lastErr?.message || "unknown"}`,
    );
  },

  /**
   * @param {string} username
   * @returns {Promise<import('../lib/schemas.js').Profile>}
   */
  async getProfile(username) {
    let res;
    try {
      res = await this.tryInstances(`/${encodeURIComponent(username)}`);
    } catch {
      res = await this.tryInstances(`/${encodeURIComponent(username)}/rss`);
    }
    const html = res.text;
    return {
      id: null,
      username,
      display_name: extractFirst(html, /class="profile-card-fullname"[^>]*>([^<]+)</),
      bio: extractFirst(html, /class="profile-bio"[^>]*>([^<]+)</),
      location: extractFirst(html, /class="profile-location"[^>]*>([^<]+)</),
      website: extractFirst(html, /class="profile-website"[^>]*>.*?href="([^"]+)"/),
      avatar:
        extractFirst(html, /data-src="([^"]+)"/) ||
        extractFirst(html, /<img src="([^"]+avatar[^"]+)"/),
      banner:
        extractFirst(html, /profile-banner[^"]*"([^"]+)"/) ||
        extractFirst(html, /cover[^"]+src="([^"]+)"/),
      followers: extractInt(html, /"followers"[^>]*>([0-9,.]+)/),
      following: extractInt(html, /"following"[^>]*>([0-9,.]+)/),
      tweets_count: extractInt(html, /"statuses"[^>]*>([0-9,.]+)/),
      likes_count: null,
      listed_count: null,
      verified: null,
      protected: null,
      joined_at: null,
      pinned_tweet: null,
    };
  },

  async getUserTweets(username, limit = 20) {
    const res = await this.tryInstances(`/${encodeURIComponent(username)}/rss`);
    const tweets = parseRssFeed(res.text, res.base, username);
    return tweets.slice(0, limit);
  },

  async searchTweets(query, limit = 20) {
    const q = encodeURIComponent(query);
    const res = await this.tryInstances(`/search?f=tweets&q=${q}`);
    const tweets = parseHtmlTweets(res.text, res.base);
    return tweets.slice(0, limit);
  },

  async getReplies(tweetId, limit = 20) {
    const res = await this.tryInstances(`/i/status/${encodeURIComponent(tweetId)}`);
    const items = parseHtmlTweets(res.text, res.base, true);
    return items.slice(0, limit);
  },

  async getQuotes(tweetId, limit = 20) {
    return this.searchTweets(`quoted_tweet:${tweetId}`, limit);
  },

  async getMentions(username, limit = 20) {
    return this.searchTweets(`@${username}`, limit);
  },

  async getTrends() {
    const res = await this.tryInstances("/trends");
    const html = res.text;
    const trends = [];
    const re =
      /class="trend-item"[^>]*>.*?href="\/search\?q=([^"]+)"[^>]*>.*?<[^>]+>([^<]+)</gs;
    let m;
    while ((m = re.exec(html)) !== null) {
      const query = m[1];
      const name = m[2].trim();
      trends.push({
        name,
        url: `${res.base}/search?q=${query}`,
        promoted_content: false,
        query,
        tweet_volume: null,
        rank: trends.length + 1,
      });
    }
    return trends;
  },

  async getMedia() {
    throw new ProviderError("nitter does not support get_media");
  },
  async getTweet() {
    throw new ProviderError("nitter does not support get_tweet");
  },

  async health() {
    for (const base of settings.nitterInstances) {
      try {
        const r = await fetchJson(base, {
          headers: this.headers(),
          timeoutMs: 5000,
        });
        if (r.status < 500) return true;
      } catch {
        // try next
      }
    }
    return false;
  },
};

// ============================================================================
// RSSProvider — last-resort fallback (oEmbed + Nitter delegation)
// ============================================================================

/**
 * RSS provider — last-resort fallback. Uses Nitter RSS for timelines/search
 * and Twitter's oEmbed endpoint (`publish.twitter.com/oembed`) for minimal
 * profile info when Nitter is unreachable.
 */
export const rssProvider = {
  name: "rss",
  timeoutMs: settings.rssTimeout * 1000,

  async getUserTweets(username, limit = 20) {
    return nitterProvider.getUserTweets(username, limit);
  },

  async getProfile(username) {
    // Try Twitter oEmbed first — returns author_name without auth.
    try {
      const url = `https://publish.twitter.com/oembed?url=${encodeURIComponent(
        `https://x.com/${username}`,
      )}`;
      const r = await fetchJson(url, {
        headers: { "User-Agent": settings.userAgent, Accept: "application/json" },
        timeoutMs: this.timeoutMs,
      });
      if (r.status === 200) {
        const data = await r.json().catch(() => null);
        if (data && typeof data === "object") {
          return {
            id: null,
            username,
            display_name: typeof data.author_name === "string" ? data.author_name : username,
            bio: null,
            location: null,
            website: null,
            avatar: null,
            banner: null,
            followers: null,
            following: null,
            tweets_count: null,
            likes_count: null,
            listed_count: null,
            verified: null,
            protected: null,
            joined_at: null,
            pinned_tweet: null,
          };
        }
      }
    } catch {
      // fall through to Nitter
    }
    return nitterProvider.getProfile(username);
  },

  async getMentions(username, limit = 20) {
    return nitterProvider.getMentions(username, limit);
  },
  async searchTweets(query, limit = 20) {
    return nitterProvider.searchTweets(query, limit);
  },
  async getReplies(tweetId, limit = 20) {
    return nitterProvider.getReplies(tweetId, limit);
  },
  async getQuotes(tweetId, limit = 20) {
    return nitterProvider.getQuotes(tweetId, limit);
  },
  async getTrends() {
    return nitterProvider.getTrends();
  },

  async getTweet() {
    throw new ProviderError("rss does not support get_tweet");
  },
  async getMedia() {
    throw new ProviderError("rss does not support get_media");
  },
  async health() {
    return nitterProvider.health();
  },
};

// ============================================================================
// ProviderRegistry — tries each provider in priority order
// ============================================================================

/** All provider instances keyed by name. */
export const providers = {
  composable: composableProvider,
  syndication: syndicationProvider,
  nitter: nitterProvider,
  rss: rssProvider,
};

/**
 * Convert a snake_case method name (`get_tweet`) into the camelCase property
 * on the provider object (`getTweet`). Mirrors the Python registry which
 * uses snake_case method names throughout.
 *
 * @param {string} method  e.g. "get_tweet", "get_user_tweets"
 * @returns {string}
 */
function toCamel(method) {
  return method.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export const registry = {
  providers,

  /**
   * @returns {{ name: string, priority: number }[]}
   */
  list() {
    return settings.providerOrder
      .filter((n) => n in this.providers)
      .map((n, i) => ({ name: n, priority: i + 1 }));
  },

  /**
   * Try each provider in priority order; return the first success along with
   * its ProviderInfo. Throws ProviderError if every provider fails.
   *
   * @template T
   * @param {string} method  snake_case method name e.g. "get_tweet"
   * @param {...any} args
   * @returns {Promise<{ result: T, providerInfo: import('../lib/schemas.js').ProviderInfo }>}
   */
  async callWithFallback(method, ...args) {
    const camel = toCamel(method);
    let lastErr = null;
    const tried = [];
    for (const pname of settings.providerOrder) {
      const provider = this.providers[pname];
      if (!provider) continue;
      tried.push(pname);
      const fn = provider[camel];
      if (typeof fn !== "function") continue;
      const start = performance.now();
      try {
        const result = await fn.apply(provider, args);
        const latencyMs = performance.now() - start;
        return { result, providerInfo: providerInfo(pname, true, latencyMs) };
      } catch (e) {
        lastErr = e;
        continue;
      }
    }
    throw new ProviderError(
      `all providers failed (${tried.join(",")}); last error: ${lastErr?.message || "unknown"}`,
    );
  },

  /**
   * Probe each provider's `health()` and return a per-provider report.
   *
   * @returns {Promise<Record<string, { healthy: boolean, error?: string }>>}
   */
  async healthAll() {
    const out = {};
    for (const [name, p] of Object.entries(this.providers)) {
      try {
        const ok = await p.health();
        out[name] = { healthy: ok };
      } catch (e) {
        out[name] = { healthy: false, error: e?.message || String(e) };
      }
    }
    return out;
  },
};

/**
 * Convenience wrapper — `callWithFallback(method, ...args)` returns
 * `{ result, providerInfo }` to mirror the Python registry's tuple shape.
 *
 * @type {typeof registry.callWithFallback}
 */
export const callWithFallback = registry.callWithFallback.bind(registry);

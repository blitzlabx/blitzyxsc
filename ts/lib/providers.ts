/**
 * blitzyxsc provider registry + multi-source router.
 *
 * TypeScript port of `blitzyxsc_api/providers/`. The registry holds every
 * provider implementation and routes each request through them in priority
 * order (configurable via `BLITZYXSC_PROVIDER_ORDER`). The first provider
 * that returns a successful result wins; on failure the next is tried.
 *
 * Available providers (auth-free, public endpoints only):
 *   1. ComposableProvider — https://api.fxtwitter.com (fxtwitter JSON)
 *   2. SyndicationProvider — https://cdn.syndication.twimg.com (Twitter embed CDN)
 *   3. NitterProvider — list of public Nitter mirrors (RSS / HTML)
 *   4. RSSProvider — last-resort fallback (Nitter RSS + Twitter oEmbed)
 */

import { settings } from "./config";
import type {
  MediaItem,
  Profile,
  ProviderInfo,
  Trend,
  Tweet,
  TweetAuthor,
} from "./schemas";

/** Raised when a provider cannot fulfill a request. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}

// ---------------------------- helpers ----------------------------------------

/** Parse Twitter-style date strings (e.g. "Tue Mar 21 20:50:14 +0000 2006"). */
function parseTwitterDate(input: string | undefined | null): string | null {
  if (!input) return null;
  const s = input.trim();
  if (!s) return null;

  // Try ISO first — most modern APIs (fxtwitter) return ISO 8601.
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();

  // Twitter's "Tue Mar 21 20:50:14 +0000 2006" form
  const m = s.match(
    /^([A-Z][a-z]{2})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\+0000)\s+(\d{4})$/,
  );
  if (m) {
    const dt = new Date(
      `${m[8]}-${monthShort(m[2])}-${pad(m[3])}T${m[4]}:${m[5]}:${m[6]}Z`,
    );
    if (!Number.isNaN(dt.getTime())) return dt.toISOString();
  }

  // "Tue, 21 Mar 2006 20:50:14 GMT" (RSS pubDate)
  const rss = Date.parse(s);
  return Number.isNaN(rss) ? null : new Date(rss).toISOString();
}

function monthShort(s: string): string {
  const idx = [
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
  ].indexOf(s);
  return idx >= 0 ? String(idx + 1).padStart(2, "0") : "01";
}

function pad(n: string): string {
  return n.padStart(2, "0");
}

function toInt(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

// ---------------------------- base interface ---------------------------------

export interface BaseProvider {
  name: string;
  health(): Promise<boolean>;
  getTweet(tweetId: string): Promise<Tweet>;
  getUserTweets(
    username: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<Tweet[]>;
  getProfile(username: string): Promise<Profile>;
  searchTweets(
    query: string,
    limit?: number,
    cursor?: string | null,
    sort?: string,
  ): Promise<Tweet[]>;
  getReplies(
    tweetId: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<Tweet[]>;
  getQuotes(
    tweetId: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<Tweet[]>;
  getMentions(
    username: string,
    limit?: number,
    cursor?: string | null,
  ): Promise<Tweet[]>;
  getTrends(woeid?: number | null, location?: string | null): Promise<Trend[]>;
  getMedia(
    identifier: string,
    by?: string,
    mediaType?: string | null,
  ): Promise<MediaItem[]>;
}

/** Apply the default-unsupported behavior — every method throws ProviderError. */
function unsupported(name: string, method: string): never {
  throw new ProviderError(`${name} does not support ${method}`);
}

// ---------------------------- ComposableProvider ----------------------------

/**
 * Composable X / fxtwitter provider — uses the public fxtwitter JSON API.
 * fxtwitter serves tweet and profile data without auth; the only requirement
 * is a real User-Agent header (otherwise it returns 403).
 *
 * Field names follow fxtwitter's shape:
 *   - tweets: `author` block, `replies/retweets/likes/quotes/views` (no _count)
 *   - profile: `user` block, `followers/following/tweets/likes` (no _count)
 */
class ComposableProvider implements BaseProvider {
  name = "composable";
  baseUrl = settings.composableBaseUrl;
  timeout = settings.composableTimeout;

  private headers(): HeadersInit {
    return {
      "User-Agent": settings.userAgent,
      Accept: "application/json",
      "Accept-Language": "en-US,en;q=0.9",
    };
  }

  async getTweet(tweetId: string): Promise<Tweet> {
    const res = await this.fetch(`${this.baseUrl}/status/${tweetId}`);
    const data = (res ?? {}) as Record<string, unknown>;
    if (!data || typeof data !== "object" || !("tweet" in data)) {
      throw new ProviderError(`composable tweet ${tweetId}: empty`);
    }
    return this.parseTweet(data.tweet as Record<string, unknown>);
  }

  async getProfile(username: string): Promise<Profile> {
    const res = await this.fetch(`${this.baseUrl}/${username}`);
    const data = (res ?? {}) as Record<string, unknown>;
    const u = (data.user ?? {}) as Record<string, unknown>;
    if (!u || Object.keys(u).length === 0) {
      throw new ProviderError(`composable profile ${username}: empty`);
    }
    const verification = (u.verification ?? {}) as Record<string, unknown>;
    return {
      id: toStr(u.id ?? ""),
      username: toStr(u.screen_name ?? username),
      display_name: (u.name as string) ?? null,
      bio: (u.description as string) ?? null,
      location: (u.location as string) ?? null,
      website: (u.website as string) || (u.url as string) || null,
      avatar: (u.avatar_url as string) ?? null,
      banner: (u.banner_url as string) ?? null,
      followers: toInt(u.followers),
      following: toInt(u.following),
      tweets_count: toInt(u.tweets),
      likes_count: toInt(u.likes),
      listed_count: null,
      verified:
        typeof verification === "object" && verification
          ? (verification.verified as boolean) ?? null
          : (verification as unknown as boolean) ?? null,
      protected: (u.protected as boolean) ?? null,
      joined_at: parseTwitterDate(u.created_at as string),
      pinned_tweet: null,
    };
  }

  async getUserTweets(): Promise<Tweet[]> {
    // fxtwitter's user timeline endpoint is not consistently available across
    // deployments; we delegate to the Nitter RSS fallback in the registry.
    unsupported(this.name, "get_user_tweets");
  }

  async searchTweets(): Promise<Tweet[]> {
    unsupported(this.name, "search_tweets");
  }

  async getReplies(): Promise<Tweet[]> {
    unsupported(this.name, "get_replies");
  }

  async getQuotes(): Promise<Tweet[]> {
    unsupported(this.name, "get_quotes");
  }

  async getMentions(): Promise<Tweet[]> {
    unsupported(this.name, "get_mentions");
  }

  async getTrends(): Promise<Trend[]> {
    unsupported(this.name, "get_trends");
  }

  async getMedia(): Promise<MediaItem[]> {
    unsupported(this.name, "get_media");
  }

  async health(): Promise<boolean> {
    try {
      const r = await fetch(this.baseUrl, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      return r.status < 500;
    } catch {
      return false;
    }
  }

  private async fetch(url: string): Promise<unknown> {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(this.timeout * 1000),
        redirect: "follow",
      });
    } catch (e) {
      throw new ProviderError(`composable fetch ${url}: ${(e as Error).message}`);
    }
    if (res.status === 404) {
      throw new ProviderError(`composable ${url}: not found (404)`);
    }
    if (!res.ok) {
      throw new ProviderError(
        `composable ${url}: HTTP ${res.status} ${res.statusText}`,
      );
    }
    try {
      return await res.json();
    } catch (e) {
      throw new ProviderError(`composable ${url}: bad JSON (${(e as Error).message})`);
    }
  }

  private parseTweet(t: Record<string, unknown>): Tweet {
    const userData =
      (t.author as Record<string, unknown> | undefined) ||
      (t.user as Record<string, unknown> | undefined) ||
      {};
    const author: TweetAuthor = {
      id: toStr(userData.id ?? ""),
      username: toStr(userData.screen_name ?? userData.username ?? ""),
      display_name: (userData.name as string) ?? null,
      avatar:
        (userData.profile_image_url as string) ||
        (userData.avatar_url as string) ||
        null,
      verified: (userData.verified as boolean) ?? null,
    };

    const media: MediaItem[] = [];
    const mediaBlock = t.media as Record<string, unknown> | undefined;
    const allMedia: Record<string, unknown>[] = Array.isArray(mediaBlock)
      ? mediaBlock
      : Array.isArray(mediaBlock?.all)
        ? (mediaBlock!.all as Record<string, unknown>[])
        : [];
    for (const m of allMedia) {
      media.push({
        type: (m.type as string) ?? "photo",
        url: (m.url as string) ?? "",
        alt: (m.altText as string) ?? null,
        width: toInt(m.width),
        height: toInt(m.height),
        thumbnail: (m.thumbnail_url as string) ?? null,
        duration_ms: toInt(m.duration),
      });
    }

    const mentions = Array.isArray(t.mentions)
      ? (t.mentions as Record<string, unknown>[]).map((m) => ({
          username: toStr(m.screen_name ?? m.name ?? ""),
        }))
      : [];

    const quote = t.quote as Record<string, unknown> | undefined;

    return {
      id: toStr(t.id ?? ""),
      text: toStr(t.text ?? ""),
      author,
      language: (t.lang as string) ?? null,
      reply_count: toInt(t.replies),
      retweet_count: toInt(t.retweets),
      like_count: toInt(t.likes),
      quote_count: toInt(t.quotes),
      view_count: toInt(t.views),
      media,
      urls: Array.isArray(t.urls)
        ? (t.urls as Record<string, unknown>[]).map((u) => toStr(u.url))
        : [],
      hashtags: Array.isArray(t.hashtags)
        ? (t.hashtags as unknown[]).map((h) => String(h))
        : [],
      mentions,
      cashtags: [],
      is_quote: Boolean(t.quote),
      quoted_tweet: quote ? this.parseTweet(quote) : null,
      url: (t.url as string) ?? null,
      sensitive: (t.possibly_sensitive as boolean) ?? null,
      created_at: parseTwitterDate(t.created_at as string),
    };
  }
}

// ---------------------------- SyndicationProvider ----------------------------

/**
 * Twitter syndication provider — uses Twitter's own public embed CDN
 * (`cdn.syndication.twimg.com`). The tweet-result endpoint serves embed
 * JSON for any public tweet without authentication.
 */
class SyndicationProvider implements BaseProvider {
  name = "syndication";
  baseUrl = settings.syndicationBaseUrl;
  timeout = settings.syndicationTimeout;

  private headers(): HeadersInit {
    return { "User-Agent": settings.userAgent, Accept: "application/json" };
  }

  async getTweet(tweetId: string): Promise<Tweet> {
    const url = `${this.baseUrl}/tweet-result?id=${encodeURIComponent(tweetId)}&token=0`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: this.headers(),
        signal: AbortSignal.timeout(this.timeout * 1000),
        redirect: "follow",
      });
    } catch (e) {
      throw new ProviderError(`syndication tweet ${tweetId}: ${(e as Error).message}`);
    }
    if (!res.ok) {
      throw new ProviderError(
        `syndication tweet ${tweetId}: HTTP ${res.status} ${res.statusText}`,
      );
    }
    let raw: unknown;
    try {
      raw = await res.json();
    } catch (e) {
      throw new ProviderError(`syndication tweet ${tweetId}: bad JSON (${(e as Error).message})`);
    }
    if (!raw || typeof raw !== "object") {
      throw new ProviderError(`syndication tweet ${tweetId}: empty response`);
    }
    return this.parseTweet(raw as Record<string, unknown>);
  }

  async getUserTweets(): Promise<Tweet[]> {
    // The syndication timeline endpoint returns HTML in most regions and is
    // unreliable; we delegate to the Nitter RSS fallback in the registry.
    unsupported(this.name, "get_user_tweets");
  }

  async getProfile(): Promise<Profile> {
    // composable provider (fxtwitter) returns richer profile data with the
    // same User-Agent — registry falls through to it automatically.
    unsupported(this.name, "get_profile");
  }

  async searchTweets(): Promise<Tweet[]> {
    unsupported(this.name, "search_tweets");
  }

  async getReplies(): Promise<Tweet[]> {
    unsupported(this.name, "get_replies");
  }

  async getQuotes(): Promise<Tweet[]> {
    unsupported(this.name, "get_quotes");
  }

  async getMentions(): Promise<Tweet[]> {
    unsupported(this.name, "get_mentions");
  }

  async getTrends(): Promise<Trend[]> {
    unsupported(this.name, "get_trends");
  }

  async getMedia(): Promise<MediaItem[]> {
    unsupported(this.name, "get_media");
  }

  async health(): Promise<boolean> {
    try {
      const r = await fetch(`${this.baseUrl}/`, {
        method: "GET",
        headers: this.headers(),
        signal: AbortSignal.timeout(5000),
      });
      return r.status < 500;
    } catch {
      return false;
    }
  }

  private parseTweet(raw: Record<string, unknown>): Tweet {
    const user = (raw.user ?? {}) as Record<string, unknown>;
    const author: TweetAuthor = {
      id: toStr(user.id_str ?? user.id ?? ""),
      username: toStr(user.screen_name ?? ""),
      display_name: (user.name as string) ?? null,
      avatar: (user.profile_image_url_https as string) ?? null,
      verified: (user.verified as boolean) ?? null,
    };

    const media: MediaItem[] = [];
    const mediaSource =
      (raw.mediaDetails as Record<string, unknown>[] | undefined) ||
      (((raw.extended_entities as Record<string, unknown> | undefined)?.media ??
        []) as Record<string, unknown>[]);
    for (const m of mediaSource) {
      const originalInfo = (m.original_info ?? {}) as Record<string, unknown>;
      media.push({
        type: (m.type as string) ?? "photo",
        url: (m.media_url_https as string) || (m.media_url as string) || "",
        alt: (m.altText as string) || (m.display_url as string) || null,
        width: toInt(originalInfo.width),
        height: toInt(originalInfo.height),
        thumbnail: (m.media_url_https as string) ?? null,
        duration_ms: toInt(m.duration_millis),
      });
    }

    const entities = (raw.entities ?? {}) as Record<string, unknown>;
    const urls = Array.isArray(entities.urls)
      ? (entities.urls as Record<string, unknown>[]).map((u) =>
          toStr(u.expanded_url ?? u.url),
        )
      : [];
    const hashtags = Array.isArray(entities.hashtags)
      ? (entities.hashtags as Record<string, unknown>[]).map((h) =>
          toStr(h.text),
        )
      : [];
    const mentions = Array.isArray(entities.user_mentions)
      ? (entities.user_mentions as Record<string, unknown>[]).map((m) => ({
          username: toStr(m.screen_name ?? ""),
          id: toStr(m.id_str ?? ""),
        }))
      : [];
    const cashtags = Array.isArray(entities.symbols)
      ? (entities.symbols as Record<string, unknown>[]).map((c) => toStr(c.text))
      : [];

    let quoted: Tweet | null = null;
    const quotedId = raw.quoted_status_id_str as string | undefined;
    const quotedStatus = raw.quoted_status as
      | Record<string, unknown>
      | undefined;
    if ((quotedId || quotedStatus) && quotedStatus) {
      quoted = this.parseTweet(quotedStatus);
    }

    const idStr = toStr(raw.id_str ?? raw.id ?? "");
    return {
      id: idStr,
      text: toStr(raw.text ?? raw.full_text ?? ""),
      author,
      language: (raw.lang as string) ?? null,
      source: (raw.source as string) ?? null,
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
      conversation_id: raw.conversation_id_str
        ? toStr(raw.conversation_id_str)
        : null,
      in_reply_to: raw.in_reply_to_status_id_str
        ? toStr(raw.in_reply_to_status_id_str)
        : null,
      is_quote: Boolean(quoted),
      quoted_tweet: quoted,
      url: `https://x.com/${author.username}/status/${idStr}`,
      sensitive: (raw.possibly_sensitive as boolean) ?? null,
      created_at: parseTwitterDate(raw.created_at as string),
    };
  }
}

// ---------------------------- NitterProvider ---------------------------------

/**
 * Nitter provider — public Nitter mirrors serve RSS / HTML for free.
 * Tries a list of instances in order; first that responds with 200 wins.
 */
class NitterProvider implements BaseProvider {
  name = "nitter";
  timeout = settings.nitterTimeout;

  private headers(): HeadersInit {
    return { "User-Agent": settings.userAgent, Accept: "*/*" };
  }

  private async tryInstances(
    path: string,
  ): Promise<{ text: string; base: string }> {
    let lastErr: Error | null = null;
    for (const base of settings.nitterInstances) {
      const url = `${base}${path}`;
      try {
        const r = await fetch(url, {
          headers: this.headers(),
          signal: AbortSignal.timeout(this.timeout * 1000),
          redirect: "follow",
        });
        if (r.status === 200) {
          const text = await r.text();
          if (text) return { text, base };
        }
      } catch (e) {
        lastErr = e as Error;
      }
    }
    throw new ProviderError(
      `all Nitter instances failed for ${path}: ${lastErr?.message ?? "unknown"}`,
    );
  }

  async getProfile(username: string): Promise<Profile> {
    let res: { text: string; base: string };
    try {
      res = await this.tryInstances(`/${username}`);
    } catch {
      res = await this.tryInstances(`/${username}/rss`);
    }
    const html = res.text;
    return {
      username,
      display_name: extractFirst(html, /class="profile-card-fullname"[^>]*>([^<]+)</) ?? null,
      bio: extractFirst(html, /class="profile-bio"[^>]*>([^<]+)</) ?? null,
      location: extractFirst(html, /class="profile-location"[^>]*>([^<]+)</) ?? null,
      website:
        extractFirst(html, /class="profile-website"[^>]*>.*?href="([^"]+)"/) ??
        null,
      avatar:
        extractFirst(html, /data-src="([^"]+)"/) ??
        extractFirst(html, /<img src="([^"]+avatar[^"]+)"/) ??
        null,
      banner:
        extractFirst(html, /profile-banner[^"]*"([^"]+)"/) ??
        extractFirst(html, /cover[^"]+src="([^"]+)"/) ??
        null,
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
  }

  async getUserTweets(
    username: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    const res = await this.tryInstances(`/${username}/rss`);
    const tweets = parseRssFeed(res.text, res.base, username);
    return tweets.slice(0, limit);
  }

  async searchTweets(
    query: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    const q = encodeURIComponent(query);
    const res = await this.tryInstances(`/search?f=tweets&q=${q}`);
    const tweets = parseHtmlTweets(res.text, res.base);
    return tweets.slice(0, limit);
  }

  async getReplies(
    tweetId: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    const res = await this.tryInstances(`/i/status/${tweetId}`);
    const items = parseHtmlTweets(res.text, res.base, true);
    return items.slice(0, limit);
  }

  async getQuotes(
    tweetId: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    // No dedicated quote-tweet endpoint on Nitter; reuse search.
    return this.searchTweets(`quoted_tweet:${tweetId}`, limit);
  }

  async getMentions(
    username: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.searchTweets(`@${username}`, limit);
  }

  async getTrends(): Promise<Trend[]> {
    const res = await this.tryInstances("/trends");
    const html = res.text;
    const trends: Trend[] = [];
    const re =
      /class="trend-item"[^>]*>.*?href="\/search\?q=([^"]+)"[^>]*>.*?<[^>]+>([^<]+)</gs;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      const query = m[1];
      const name = m[2].trim();
      trends.push({
        name,
        query,
        url: `${res.base}/search?q=${query}`,
        rank: trends.length + 1,
      });
    }
    return trends;
  }

  async getMedia(): Promise<MediaItem[]> {
    unsupported(this.name, "get_media");
  }

  async getTweet(): Promise<Tweet> {
    unsupported(this.name, "get_tweet");
  }

  async health(): Promise<boolean> {
    for (const base of settings.nitterInstances) {
      try {
        const r = await fetch(base, {
          method: "GET",
          headers: this.headers(),
          signal: AbortSignal.timeout(5000),
        });
        if (r.status < 500) return true;
      } catch {
        // try next
      }
    }
    return false;
  }
}

// ---------------------------- RSSProvider ------------------------------------

/**
 * RSS provider — last-resort fallback. Uses Nitter RSS for timelines/search
 * and Twitter's oEmbed endpoint (`publish.twitter.com/oembed`) for minimal
 * profile info.
 */
class RSSProvider implements BaseProvider {
  name = "rss";
  timeout = settings.rssTimeout;
  private nitter = new NitterProvider();

  async getUserTweets(
    username: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.nitter.getUserTweets(username, limit);
  }

  async getProfile(username: string): Promise<Profile> {
    // Try Twitter oEmbed first — it returns author_name without auth.
    try {
      const r = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(`https://x.com/${username}`)}`,
        {
          headers: { "User-Agent": settings.userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(this.timeout * 1000),
        },
      );
      if (r.status === 200) {
        const data = (await r.json()) as { author_name?: string };
        return {
          username,
          display_name: data.author_name ?? username,
        };
      }
    } catch {
      // fall through to Nitter
    }
    return this.nitter.getProfile(username);
  }

  async getMentions(
    username: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.nitter.getMentions(username, limit);
  }

  async searchTweets(
    query: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.nitter.searchTweets(query, limit);
  }

  async getReplies(
    tweetId: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.nitter.getReplies(tweetId, limit);
  }

  async getQuotes(
    tweetId: string,
    limit: number = 20,
  ): Promise<Tweet[]> {
    return this.nitter.getQuotes(tweetId, limit);
  }

  async getTrends(): Promise<Trend[]> {
    return this.nitter.getTrends();
  }

  async getTweet(): Promise<Tweet> {
    unsupported(this.name, "get_tweet");
  }

  async getMedia(): Promise<MediaItem[]> {
    unsupported(this.name, "get_media");
  }

  async health(): Promise<boolean> {
    return this.nitter.health();
  }
}

// ---------------------------- helpers (Nitter parsing) -----------------------

function extractFirst(html: string, pattern: RegExp): string | null {
  const m = pattern.exec(html);
  return m ? m[1].trim() : null;
}

function extractInt(html: string, pattern: RegExp): number | null {
  const m = pattern.exec(html);
  if (!m) return null;
  const s = m[1]
    .replace(/,/g, "")
    .replace(/\./g, "")
    .replace("K", "000")
    .replace("M", "000000");
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function parseRssFeed(
  xml: string,
  base: string,
  defaultUsername = "",
): Tweet[] {
  if (!xml) return [];
  const items: Tweet[] = [];
  const itemRe =
    /<item\b[\s\S]*?<\/item>|<entry\b[\s\S]*?<\/entry>/g;
  let im: RegExpExecArray | null;
  while ((im = itemRe.exec(xml)) !== null) {
    const block = im[0];
    const title =
      textOf(block, /<title[^>]*>([\s\S]*?)<\/title>/) ?? "";
    const link =
      textOf(block, /<link[^>]*>([\s\S]*?)<\/link>/) ||
      attrOf(block, /<link[^>]*href="([^"]+)"/) ||
      "";
    const pub =
      textOf(block, /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/) ||
      textOf(block, /<published[^>]*>([\s\S]*?)<\/published>/) ||
      "";
    const desc =
      textOf(block, /<description[^>]*>([\s\S]*?)<\/description>/) ||
      textOf(block, /<summary[^>]*>([\s\S]*?)<\/summary>/) ||
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
    const media: MediaItem[] = [];
    const imgRe = /<img[^>]+src="([^"]+)"/g;
    let mm: RegExpExecArray | null;
    while ((mm = imgRe.exec(desc)) !== null) {
      media.push({ type: "photo", url: mm[1] });
    }

    items.push({
      id: tid,
      text: plain,
      author: { username: authorPart },
      created_at: parseTwitterDate(pub.trim()),
      media,
      url: link,
      hashtags: Array.from(text.matchAll(/#(\w+)/g)).map((m) => m[1]),
      mentions: Array.from(text.matchAll(/@(\w+)/g)).map((m) => ({
        username: m[1],
      })),
      cashtags: [],
      urls: [],
      quote_count: null,
      like_count: null,
      reply_count: null,
      retweet_count: null,
      view_count: null,
      is_quote: false,
      quoted_tweet: null,
      is_retweet: null,
      retweeted_tweet: null,
      conversation_id: null,
      in_reply_to: null,
      language: null,
      source: null,
      sensitive: null,
      bookmark_count: null,
    });
  }
  return items;
}

function parseHtmlTweets(
  html: string,
  base: string,
  skipFirst = false,
): Tweet[] {
  const tweets: Tweet[] = [];
  const blockRe =
    /<div class="timeline-item[^"]*"[^>]*>([\s\S]*?)<div class="timeline-item/g;
  const blocks: string[] = [];
  let bm: RegExpExecArray | null;
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

    const media: MediaItem[] = [];
    const imgRe =
      /data-src="([^"]+)"|src="([^"]+\.(?:jpg|png|webp)[^"]*)"/g;
    let mm: RegExpExecArray | null;
    while ((mm = imgRe.exec(blk)) !== null) {
      const url = mm[1] || mm[2];
      if (url) media.push({ type: "photo", url });
    }

    tweets.push({
      id: tid,
      text,
      author: { username },
      media,
      hashtags: Array.from(text.matchAll(/#(\w+)/g)).map((m) => m[1]),
      mentions: Array.from(text.matchAll(/@(\w+)/g)).map((m) => ({
        username: m[1],
      })),
      cashtags: [],
      urls: [],
      quote_count: null,
      like_count: null,
      reply_count: null,
      retweet_count: null,
      view_count: null,
      is_quote: false,
      quoted_tweet: null,
      is_retweet: null,
      retweeted_tweet: null,
      conversation_id: null,
      in_reply_to: null,
      language: null,
      source: null,
      sensitive: null,
      bookmark_count: null,
      created_at: null,
    });
  }
  return tweets;
}

function textOf(s: string, re: RegExp): string | null {
  const m = re.exec(s);
  return m ? m[1] : null;
}
function attrOf(s: string, re: RegExp): string | null {
  const m = re.exec(s);
  return m ? m[1] : null;
}
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

// ---------------------------- ProviderRegistry -------------------------------

type ProviderMethodName =
  | "getTweet"
  | "getUserTweets"
  | "getProfile"
  | "searchTweets"
  | "getReplies"
  | "getQuotes"
  | "getMentions"
  | "getTrends"
  | "getMedia";

interface CallResult<T> {
  result: T;
  info: ProviderInfo;
}

class ProviderRegistry {
  providers: Record<string, BaseProvider> = {
    composable: new ComposableProvider(),
    syndication: new SyndicationProvider(),
    nitter: new NitterProvider(),
    rss: new RSSProvider(),
  };

  list(): { name: string; priority: number }[] {
    return settings.providerOrder
      .filter((n) => n in this.providers)
      .map((n, i) => ({ name: n, priority: i + 1 }));
  }

  /** Try each provider in priority order; return first success. */
  async callWithFallback<T>(
    method: ProviderMethodName,
    ...args: unknown[]
  ): Promise<CallResult<T>> {
    let lastErr: Error | null = null;
    const tried: string[] = [];
    for (const pname of settings.providerOrder) {
      const provider = this.providers[pname];
      if (!provider) continue;
      tried.push(pname);
      const fn = (
        provider as unknown as Record<
          string,
          (...a: unknown[]) => Promise<T>
        >
      )[method];
      if (typeof fn !== "function") continue;
      const start = performance.now();
      try {
        const result = await fn.apply(provider, args);
        const latency_ms = performance.now() - start;
        return { result, info: { name: pname, ok: true, latency_ms } };
      } catch (e) {
        lastErr = e as Error;
        continue;
      }
    }
    throw new ProviderError(
      `all providers failed (${tried.join(",")}); last error: ${lastErr?.message ?? "unknown"}`,
    );
  }

  async healthAll(): Promise<Record<string, { healthy: boolean; error?: string }>> {
    const out: Record<string, { healthy: boolean; error?: string }> = {};
    for (const [name, p] of Object.entries(this.providers)) {
      try {
        const ok = await p.health();
        out[name] = { healthy: ok };
      } catch (e) {
        out[name] = { healthy: false, error: (e as Error).message };
      }
    }
    return out;
  }
}

export const registry = new ProviderRegistry();

export { ComposableProvider, SyndicationProvider, NitterProvider, RSSProvider };

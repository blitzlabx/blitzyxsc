/**
 * Pure parser for the fxtwitter / composable JSON shape.
 *
 * Mirrors the Python `_parse_tweet` and `get_profile` logic in
 * `blitzyxsc_api/providers/composable.py`. The same parser is reused by the
 * `composableProvider` so the logic stays in one place and is easy to test
 * in isolation.
 *
 * fxtwitter field conventions:
 *   - tweet objects:        `author` block, `replies/retweets/likes/quotes/views`
 *   - profile objects:      `user` block, `followers/following/tweets/likes`
 *
 * All functions are pure — they take plain JSON-decoded objects and return
 * normalized blitzyxsc shapes.
 */

const MONTHS = [
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
 * Coerce any value into an integer or null.
 *
 * @param {unknown} v
 * @returns {number | null}
 */
export function toInt(v) {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Coerce any value into a string (empty string for null / undefined).
 *
 * @param {unknown} v
 * @returns {string}
 */
export function toStr(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/**
 * Parse a Twitter-style date string into an ISO 8601 string (UTC).
 *
 * Accepts ISO 8601 directly, plus Twitter's
 *   "Tue Mar 21 20:50:14 +0000 2006"
 * form. Returns null when the input cannot be parsed.
 *
 * @param {string | null | undefined} input
 * @returns {string | null}
 */
export function parseTwitterDate(input) {
  if (!input) return null;
  const s = String(input).trim();
  if (!s) return null;

  // ISO 8601 — most modern APIs (fxtwitter) return ISO directly.
  const iso = Date.parse(s);
  if (!Number.isNaN(iso)) return new Date(iso).toISOString();

  // Twitter's "Tue Mar 21 20:50:14 +0000 2006" form
  const m = s.match(
    /^([A-Z][a-z]{2})\s+([A-Z][a-z]{2})\s+(\d{1,2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\+0000)\s+(\d{4})$/,
  );
  if (m) {
    const monthIdx = MONTHS.indexOf(m[2]);
    if (monthIdx >= 0) {
      const dt = new Date(
        Date.UTC(
          parseInt(m[8], 10),
          monthIdx,
          parseInt(m[3], 10),
          parseInt(m[4], 10),
          parseInt(m[5], 10),
          parseInt(m[6], 10),
        ),
      );
      if (!Number.isNaN(dt.getTime())) return dt.toISOString();
    }
  }

  // Last-resort: let Date.parse try the rest ("Tue, 21 Mar 2006 20:50:14 GMT")
  const fallback = Date.parse(s);
  return Number.isNaN(fallback) ? null : new Date(fallback).toISOString();
}

/**
 * Normalize a single fxtwitter tweet object into the blitzyxsc Tweet shape.
 *
 * Pure — does not call any provider / network. Recursively parses the quoted
 * tweet if present.
 *
 * @param {Record<string, any>} t  raw fxtwitter tweet object
 * @returns {import('../lib/schemas.js').Tweet}
 */
export function parseTweet(t) {
  if (!t || typeof t !== "object") {
    return blankTweet();
  }

  const userData = t.author || t.user || {};
  /** @type {import('../lib/schemas.js').TweetAuthor} */
  const author = {
    id: toStr(userData.id ?? ""),
    username: toStr(userData.screen_name ?? userData.username ?? ""),
    display_name: typeof userData.name === "string" ? userData.name : null,
    avatar:
      (typeof userData.profile_image_url === "string" && userData.profile_image_url) ||
      (typeof userData.avatar_url === "string" && userData.avatar_url) ||
      null,
    verified: typeof userData.verified === "boolean" ? userData.verified : null,
  };

  /** @type {import('../lib/schemas.js').MediaItem[]} */
  const media = [];
  const mediaBlock = t.media;
  let allMedia = [];
  if (Array.isArray(mediaBlock)) {
    allMedia = mediaBlock;
  } else if (mediaBlock && typeof mediaBlock === "object" && Array.isArray(mediaBlock.all)) {
    allMedia = mediaBlock.all;
  }
  for (const m of allMedia) {
    if (!m || typeof m !== "object") continue;
    media.push({
      type: typeof m.type === "string" ? m.type : "photo",
      url: typeof m.url === "string" ? m.url : "",
      alt: typeof m.altText === "string" ? m.altText : null,
      width: toInt(m.width),
      height: toInt(m.height),
      thumbnail: typeof m.thumbnail_url === "string" ? m.thumbnail_url : null,
      duration_ms: toInt(m.duration),
    });
  }

  const mentions = Array.isArray(t.mentions)
    ? t.mentions.map((m) => ({
        username: toStr(m?.screen_name ?? m?.name ?? ""),
        id: toStr(m?.id_str ?? m?.id ?? "") || null,
      }))
    : [];

  const quote = t.quote && typeof t.quote === "object" ? t.quote : null;

  return {
    id: toStr(t.id ?? ""),
    text: toStr(t.text ?? ""),
    author,
    created_at: parseTwitterDate(t.created_at),
    language: typeof t.lang === "string" ? t.lang : null,
    source: typeof t.source === "string" ? t.source : null,
    reply_count: toInt(t.replies),
    retweet_count: toInt(t.retweets),
    like_count: toInt(t.likes),
    quote_count: toInt(t.quotes),
    bookmark_count: toInt(t.bookmark_count),
    view_count: toInt(t.views),
    media,
    urls: Array.isArray(t.urls)
      ? t.urls.map((u) => (u && typeof u === "object" ? toStr(u.url) : toStr(u)))
      : [],
    hashtags: Array.isArray(t.hashtags) ? t.hashtags.map((h) => String(h)) : [],
    mentions,
    cashtags: Array.isArray(t.cashtags) ? t.cashtags.map((c) => String(c)) : [],
    conversation_id: t.conversation_id_str ? toStr(t.conversation_id_str) : null,
    in_reply_to: t.in_reply_to_status_id_str ? toStr(t.in_reply_to_status_id_str) : null,
    is_quote: Boolean(quote),
    quoted_tweet: quote ? parseTweet(quote) : null,
    is_retweet: null,
    retweeted_tweet: null,
    url: typeof t.url === "string" ? t.url : null,
    sensitive: typeof t.possibly_sensitive === "boolean" ? t.possibly_sensitive : null,
  };
}

/**
 * Normalize a fxtwitter profile response (`{ user: {...} }`) into the
 * blitzyxsc Profile shape.
 *
 * @param {Record<string, any>} data   raw fxtwitter profile payload
 * @param {string} username           fallback username when API omits it
 * @returns {import('../lib/schemas.js').Profile}
 */
export function parseProfile(data, username) {
  const u = (data && data.user) || {};
  const verification = u.verification || {};
  const verified =
    typeof verification === "object" && verification
      ? typeof verification.verified === "boolean"
        ? verification.verified
        : null
      : typeof verification === "boolean"
        ? verification
        : null;
  return {
    id: toStr(u.id ?? ""),
    username: toStr(u.screen_name ?? username),
    display_name: typeof u.name === "string" ? u.name : null,
    bio: typeof u.description === "string" ? u.description : null,
    location: typeof u.location === "string" ? u.location : null,
    website: typeof u.website === "string" && u.website ? u.website : (typeof u.url === "string" ? u.url : null),
    avatar: typeof u.avatar_url === "string" ? u.avatar_url : null,
    banner: typeof u.banner_url === "string" ? u.banner_url : null,
    followers: toInt(u.followers),
    following: toInt(u.following),
    tweets_count: toInt(u.tweets),
    likes_count: toInt(u.likes),
    listed_count: null,
    verified,
    protected: typeof u.protected === "boolean" ? u.protected : null,
    joined_at: parseTwitterDate(u.created_at),
    pinned_tweet: null,
  };
}

/** @returns {import('../lib/schemas.js').Tweet} */
function blankTweet() {
  return {
    id: "",
    text: "",
    author: null,
    created_at: null,
    language: null,
    source: null,
    reply_count: null,
    retweet_count: null,
    like_count: null,
    quote_count: null,
    bookmark_count: null,
    view_count: null,
    media: [],
    urls: [],
    hashtags: [],
    mentions: [],
    cashtags: [],
    conversation_id: null,
    in_reply_to: null,
    is_quote: false,
    quoted_tweet: null,
    is_retweet: null,
    retweeted_tweet: null,
    url: null,
    sensitive: null,
  };
}

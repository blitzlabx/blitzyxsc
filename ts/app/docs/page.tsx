import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Docs",
  description: "blitzyxsc API reference — every endpoint grouped by router.",
};

type Endpoint = {
  method: "GET";
  path: string;
  /** path with relative /api prefix rendered for playground links */
  apiPath: string;
  summary: string;
  params?: { name: string; type: string; required?: boolean; default?: string }[];
};

type RouterGroup = {
  name: string;
  tag: string;
  blurb: string;
  endpoints: Endpoint[];
};

const GROUPS: RouterGroup[] = [
  {
    name: "Meta",
    tag: "Service health + provider registry",
    blurb:
      "Service metadata, provider health probes, and the multi-provider router status.",
    endpoints: [
      {
        method: "GET",
        path: "/api/health",
        apiPath: "/api/health",
        summary: "Service health check + uptime + provider list.",
      },
      {
        method: "GET",
        path: "/api/providers",
        apiPath: "/api/providers",
        summary: "List configured providers and their priority order.",
      },
    ],
  },
  {
    name: "Posts & Timeline",
    tag: "Posts & Timeline",
    blurb:
      "Single-tweet lookup and user timeline fetching. Powered by the composable (fxtwitter), syndication, and Nitter fallbacks.",
    endpoints: [
      {
        method: "GET",
        path: "/api/posts/{tweet_id}",
        apiPath: "/api/posts/{tweet_id}",
        summary: "Get a single tweet by ID — full metadata, media, engagement.",
        params: [
          { name: "tweet_id", type: "path", required: true },
        ],
      },
      {
        method: "GET",
        path: "/api/posts/user/{username}",
        apiPath: "/api/posts/user/{username}",
        summary: "Get tweets from a user's timeline (paginated).",
        params: [
          { name: "username", type: "path", required: true },
          { name: "limit", type: "int", default: "20 (max 100)" },
          { name: "cursor", type: "string" },
        ],
      },
    ],
  },
  {
    name: "Profile",
    tag: "Profile",
    blurb:
      "User profile lookups: bio, avatar, banner, follower counts, verified status, etc.",
    endpoints: [
      {
        method: "GET",
        path: "/api/profile/{username}",
        apiPath: "/api/profile/{username}",
        summary: "Get a user's profile — full metadata + counts.",
        params: [{ name: "username", type: "path", required: true }],
      },
    ],
  },
  {
    name: "Search",
    tag: "Search",
    blurb:
      "Keyword search with Twitter advanced query syntax (from:, since:, #, @, min_faves:, filter:images …).",
    endpoints: [
      {
        method: "GET",
        path: "/api/search",
        apiPath: "/api/search",
        summary: "Search tweets by keyword (Twitter advanced query supported).",
        params: [
          { name: "q", type: "string", required: true },
          { name: "limit", type: "int", default: "20 (max 100)" },
          { name: "sort", type: "string", default: "latest" },
          { name: "cursor", type: "string" },
        ],
      },
    ],
  },
  {
    name: "Replies & Comments",
    tag: "Replies & Comments",
    blurb: "Conversation threads and reply trees under a tweet.",
    endpoints: [
      {
        method: "GET",
        path: "/api/replies/{tweet_id}",
        apiPath: "/api/replies/{tweet_id}",
        summary: "Get replies to a tweet.",
        params: [
          { name: "tweet_id", type: "path", required: true },
          { name: "limit", type: "int", default: "20 (max 100)" },
          { name: "cursor", type: "string" },
        ],
      },
    ],
  },
  {
    name: "Mentions",
    tag: "Mentions",
    blurb: "Tweets that @-mention a given user.",
    endpoints: [
      {
        method: "GET",
        path: "/api/mentions/{username}",
        apiPath: "/api/mentions/{username}",
        summary: "Get tweets mentioning a user.",
        params: [
          { name: "username", type: "path", required: true },
          { name: "limit", type: "int", default: "20 (max 100)" },
          { name: "cursor", type: "string" },
        ],
      },
    ],
  },
  {
    name: "Trends",
    tag: "Trends",
    blurb: "Current trending topics.",
    endpoints: [
      {
        method: "GET",
        path: "/api/trends",
        apiPath: "/api/trends",
        summary: "Get current trends (optionally filtered by WOEID/location).",
        params: [
          { name: "woeid", type: "int" },
          { name: "location", type: "string" },
        ],
      },
    ],
  },
  {
    name: "Media",
    tag: "Media",
    blurb: "Extract images, videos, GIFs from tweets and users.",
    endpoints: [
      {
        method: "GET",
        path: "/api/media/tweet/{tweet_id}",
        apiPath: "/api/media/tweet/{tweet_id}",
        summary: "Get all media attached to a tweet.",
        params: [{ name: "tweet_id", type: "path", required: true }],
      },
    ],
  },
  {
    name: "Quotes",
    tag: "Quotes",
    blurb: "Quote tweets — tweets that quote another tweet.",
    endpoints: [
      {
        method: "GET",
        path: "/api/quotes/{tweet_id}",
        apiPath: "/api/quotes/{tweet_id}",
        summary: "Get quote tweets of a tweet.",
        params: [
          { name: "tweet_id", type: "path", required: true },
          { name: "limit", type: "int", default: "20 (max 100)" },
          { name: "cursor", type: "string" },
        ],
      },
    ],
  },
];

// 80 endpoints total — these are the canonical routes; the Python service
// ships additional filter aliases (e.g. /posts/user/{username}/media,
// /posts/id/{tweet_id}/text) that mirror the same shapes. They're listed
// here as references so the playground can reach them when the deployed
// API exposes them.
const EXTENDED_ENDPOINTS: Endpoint[] = [
  {
    method: "GET",
    path: "/api/posts/user/{username}/media",
    apiPath: "/api/posts/user/{username}/media",
    summary: "Get tweets with media from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/photos",
    apiPath: "/api/posts/user/{username}/photos",
    summary: "Get tweets with photos from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/videos",
    apiPath: "/api/posts/user/{username}/videos",
    summary: "Get tweets with videos from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/gifs",
    apiPath: "/api/posts/user/{username}/gifs",
    summary: "Get tweets with GIFs from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/replies",
    apiPath: "/api/posts/user/{username}/replies",
    summary: "Get replies posted by a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/original",
    apiPath: "/api/posts/user/{username}/original",
    summary: "Get original tweets (no replies, no retweets) from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/retweets",
    apiPath: "/api/posts/user/{username}/retweets",
    summary: "Get retweets posted by a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/quotes",
    apiPath: "/api/posts/user/{username}/quotes",
    summary: "Get quote tweets posted by a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/text-only",
    apiPath: "/api/posts/user/{username}/text-only",
    summary: "Get text-only tweets from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/user/{username}/pinned",
    apiPath: "/api/posts/user/{username}/pinned",
    summary: "Get a user's pinned tweet.",
    params: [{ name: "username", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/raw",
    apiPath: "/api/posts/id/{tweet_id}/raw",
    summary: "Get raw tweet data (no normalization).",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/text",
    apiPath: "/api/posts/id/{tweet_id}/text",
    summary: "Get only the text content of a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/author",
    apiPath: "/api/posts/id/{tweet_id}/author",
    summary: "Get the author of a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/stats",
    apiPath: "/api/posts/id/{tweet_id}/stats",
    summary: "Get engagement stats (replies, retweets, likes, quotes, views).",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/hashtags",
    apiPath: "/api/posts/id/{tweet_id}/hashtags",
    summary: "Get hashtags used in a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/mentions",
    apiPath: "/api/posts/id/{tweet_id}/mentions",
    summary: "Get users mentioned in a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/urls",
    apiPath: "/api/posts/id/{tweet_id}/urls",
    summary: "Get URLs contained in a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/conversation",
    apiPath: "/api/posts/id/{tweet_id}/conversation",
    summary: "Get the conversation thread containing a tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/quoted",
    apiPath: "/api/posts/id/{tweet_id}/quoted",
    summary: "Get the tweet quoted by this tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/id/{tweet_id}/retweeted",
    apiPath: "/api/posts/id/{tweet_id}/retweeted",
    summary: "Get the tweet retweeted by this tweet.",
    params: [{ name: "tweet_id", type: "path", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/ids",
    apiPath: "/api/posts/ids",
    summary: "Fetch multiple tweets by IDs (comma-separated).",
    params: [{ name: "ids", type: "csv", required: true }],
  },
  {
    method: "GET",
    path: "/api/posts/by-date",
    apiPath: "/api/posts/by-date",
    summary: "Get tweets from a user within a date range.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "since", type: "date", required: true },
      { name: "until", type: "date", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-language",
    apiPath: "/api/posts/by-language",
    summary: "Get tweets from a user filtered by language code.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "lang", type: "string", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-hashtag",
    apiPath: "/api/posts/by-hashtag",
    summary: "Get tweets from a user containing a specific hashtag.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "hashtag", type: "string", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-mention",
    apiPath: "/api/posts/by-mention",
    summary: "Get tweets from a user mentioning a specific user.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "mention", type: "string", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-min-likes",
    apiPath: "/api/posts/by-min-likes",
    summary: "Get tweets from a user with at least N likes.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "min_likes", type: "int", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-min-retweets",
    apiPath: "/api/posts/by-min-retweets",
    summary: "Get tweets from a user with at least N retweets.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "min_retweets", type: "int", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/by-min-views",
    apiPath: "/api/posts/by-min-views",
    summary: "Get tweets from a user with at least N views.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "min_views", type: "int", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/popular/{username}",
    apiPath: "/api/posts/popular/{username}",
    summary: "Get most popular tweets from a user (sorted by likes).",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "100" }],
  },
  {
    method: "GET",
    path: "/api/posts/by-source",
    apiPath: "/api/posts/by-source",
    summary: "Get tweets from a user posted via a specific source app.",
    params: [
      { name: "username", type: "string", required: true },
      { name: "source", type: "string", required: true },
      { name: "limit", type: "int" },
    ],
  },
  {
    method: "GET",
    path: "/api/posts/sensitive/{username}",
    apiPath: "/api/posts/sensitive/{username}",
    summary: "Get tweets flagged as sensitive from a user.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  {
    method: "GET",
    path: "/api/posts/clean/{username}",
    apiPath: "/api/posts/clean/{username}",
    summary: "Get tweets from a user excluding sensitive content.",
    params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }],
  },
  // Search variants (10)
  { method: "GET", path: "/api/search/latest", apiPath: "/api/search/latest", summary: "Search latest tweets.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/top", apiPath: "/api/search/top", summary: "Search top tweets (most popular).", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/advanced", apiPath: "/api/search/advanced", summary: "Advanced search with structured filters.", params: [{ name: "q", type: "string", required: true }, { name: "from_user", type: "string" }, { name: "to_user", type: "string" }, { name: "since", type: "date" }, { name: "until", type: "date" }, { name: "min_faves", type: "int" }, { name: "min_retweets", type: "int" }, { name: "lang", type: "string" }] },
  { method: "GET", path: "/api/search/people", apiPath: "/api/search/people", summary: "Search tweets mentioning people.", params: [{ name: "q", type: "string", required: true }] },
  { method: "GET", path: "/api/search/photos", apiPath: "/api/search/photos", summary: "Search tweets containing photos.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/videos", apiPath: "/api/search/videos", summary: "Search tweets containing videos.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/news", apiPath: "/api/search/news", summary: "Search tweets containing news links.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/gifs", apiPath: "/api/search/gifs", summary: "Search tweets containing GIFs.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/links", apiPath: "/api/search/links", summary: "Search tweets containing URLs.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/questions", apiPath: "/api/search/questions", summary: "Search tweets that are questions.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/positive", apiPath: "/api/search/positive", summary: "Search tweets with positive sentiment markers.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/negative", apiPath: "/api/search/negative", summary: "Search tweets with negative sentiment markers.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/hashtag/{hashtag}", apiPath: "/api/search/hashtag/{hashtag}", summary: "Search tweets containing a hashtag.", params: [{ name: "hashtag", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/cashtag/{cashtag}", apiPath: "/api/search/cashtag/{cashtag}", summary: "Search tweets containing a cashtag.", params: [{ name: "cashtag", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/mention/{username}", apiPath: "/api/search/mention/{username}", summary: "Search tweets mentioning a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/from/{username}", apiPath: "/api/search/from/{username}", summary: "Search tweets from a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/to/{username}", apiPath: "/api/search/to/{username}", summary: "Search tweets directed to a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/since/{date}", apiPath: "/api/search/since/{date}", summary: "Search tweets since a date.", params: [{ name: "q", type: "string", required: true }, { name: "date", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/until/{date}", apiPath: "/api/search/until/{date}", summary: "Search tweets until a date.", params: [{ name: "q", type: "string", required: true }, { name: "date", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/lang/{lang}", apiPath: "/api/search/lang/{lang}", summary: "Search tweets in a specific language.", params: [{ name: "q", type: "string", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/geocode/{geocode}", apiPath: "/api/search/geocode/{geocode}", summary: "Search tweets near a geocode.", params: [{ name: "q", type: "string", required: true }, { name: "geocode", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/near/{place}", apiPath: "/api/search/near/{place}", summary: "Search tweets near a place name.", params: [{ name: "q", type: "string", required: true }, { name: "place", type: "path", required: true }, { name: "within", type: "string", default: "15mi" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-faves/{min_faves}", apiPath: "/api/search/min-faves/{min_faves}", summary: "Search tweets with at least N likes.", params: [{ name: "q", type: "string", required: true }, { name: "min_faves", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-retweets/{min_retweets}", apiPath: "/api/search/min-retweets/{min_retweets}", summary: "Search tweets with at least N retweets.", params: [{ name: "q", type: "string", required: true }, { name: "min_retweets", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-replies/{min_replies}", apiPath: "/api/search/min-replies/{min_replies}", summary: "Search tweets with at least N replies.", params: [{ name: "q", type: "string", required: true }, { name: "min_replies", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/verified", apiPath: "/api/search/verified", summary: "Search tweets from verified accounts.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/no-retweets", apiPath: "/api/search/no-retweets", summary: "Search tweets excluding retweets.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/no-replies", apiPath: "/api/search/no-replies", summary: "Search tweets excluding replies.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/safe", apiPath: "/api/search/safe", summary: "Search tweets excluding sensitive content.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/original", apiPath: "/api/search/original", summary: "Search only original tweets.", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  // Profile variants (~30)
  { method: "GET", path: "/api/profile/{username}/bio", apiPath: "/api/profile/{username}/bio", summary: "Get only the bio of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/avatar", apiPath: "/api/profile/{username}/avatar", summary: "Get only the avatar URL of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/banner", apiPath: "/api/profile/{username}/banner", summary: "Get only the banner URL of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/display-name", apiPath: "/api/profile/{username}/display-name", summary: "Get only the display name of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/location", apiPath: "/api/profile/{username}/location", summary: "Get only the location of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/website", apiPath: "/api/profile/{username}/website", summary: "Get only the website of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/stats", apiPath: "/api/profile/{username}/stats", summary: "Get only the stats (followers, following, tweets, likes) of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/followers", apiPath: "/api/profile/{username}/followers", summary: "Get follower count of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/following", apiPath: "/api/profile/{username}/following", summary: "Get following count of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/tweets-count", apiPath: "/api/profile/{username}/tweets-count", summary: "Get tweet count of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/likes-count", apiPath: "/api/profile/{username}/likes-count", summary: "Get like count of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/listed-count", apiPath: "/api/profile/{username}/listed-count", summary: "Get listed count of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/verified", apiPath: "/api/profile/{username}/verified", summary: "Check if a user is verified.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/protected", apiPath: "/api/profile/{username}/protected", summary: "Check if a user is protected.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/joined", apiPath: "/api/profile/{username}/joined", summary: "Get join date of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/id", apiPath: "/api/profile/{username}/id", summary: "Get internal ID of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/summary", apiPath: "/api/profile/{username}/summary", summary: "Get a short text summary of a profile.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/pinned", apiPath: "/api/profile/{username}/pinned", summary: "Get the pinned tweet of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/exists", apiPath: "/api/profile/{username}/exists", summary: "Check if a username exists.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/combined", apiPath: "/api/profile/{username}/combined", summary: "Get profile + recent tweets in one call.", params: [{ name: "username", type: "path", required: true }, { name: "tweet_limit", type: "int", default: "10" }] },
  { method: "GET", path: "/api/profile/{username}/ratio", apiPath: "/api/profile/{username}/ratio", summary: "Get follower/following ratio of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/influence-score", apiPath: "/api/profile/{username}/influence-score", summary: "Get a basic influence score for a user (0-100).", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/bulk", apiPath: "/api/profile/bulk", summary: "Get profiles for multiple users at once.", params: [{ name: "usernames", type: "csv", required: true }] },
  { method: "GET", path: "/api/profile/{username}/age", apiPath: "/api/profile/{username}/age", summary: "Get account age in days.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/avatar-hd", apiPath: "/api/profile/{username}/avatar-hd", summary: "Get HD avatar URL.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/banner-hd", apiPath: "/api/profile/{username}/banner-hd", summary: "Get HD banner URL.", params: [{ name: "username", type: "path", required: true }] },
  // Replies variants
  { method: "GET", path: "/api/replies/{tweet_id}/latest", apiPath: "/api/replies/{tweet_id}/latest", summary: "Get latest replies to a tweet.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/tree", apiPath: "/api/replies/{tweet_id}/tree", summary: "Get the full reply tree of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "50" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/count", apiPath: "/api/replies/{tweet_id}/count", summary: "Get the reply count of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-verified", apiPath: "/api/replies/{tweet_id}/by-verified", summary: "Get replies from verified accounts only.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-author", apiPath: "/api/replies/{tweet_id}/by-author", summary: "Get replies from the original tweet's author only.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-followers", apiPath: "/api/replies/{tweet_id}/by-followers", summary: "Get replies likely from followers (best-effort).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-influencers", apiPath: "/api/replies/{tweet_id}/by-influencers", summary: "Get replies from accounts with high follower counts.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "min_followers", type: "int", default: "10000" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-media", apiPath: "/api/replies/{tweet_id}/with-media", summary: "Get replies that contain media.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-photos", apiPath: "/api/replies/{tweet_id}/with-photos", summary: "Get replies that contain photos.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-videos", apiPath: "/api/replies/{tweet_id}/with-videos", summary: "Get replies that contain videos.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-links", apiPath: "/api/replies/{tweet_id}/with-links", summary: "Get replies that contain URLs.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/popular", apiPath: "/api/replies/{tweet_id}/popular", summary: "Get the most popular replies (sorted by likes).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/controversial", apiPath: "/api/replies/{tweet_id}/controversial", summary: "Get replies with the most engagement.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/positive", apiPath: "/api/replies/{tweet_id}/positive", summary: "Get replies with positive sentiment markers.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/negative", apiPath: "/api/replies/{tweet_id}/negative", summary: "Get replies with negative sentiment markers.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/questions", apiPath: "/api/replies/{tweet_id}/questions", summary: "Get replies that are questions.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-lang/{lang}", apiPath: "/api/replies/{tweet_id}/by-lang/{lang}", summary: "Get replies in a specific language.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/oldest", apiPath: "/api/replies/{tweet_id}/oldest", summary: "Get oldest replies to a tweet.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/thread", apiPath: "/api/replies/{tweet_id}/thread", summary: "Get the conversation thread (self-replies).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "50" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/quoted", apiPath: "/api/replies/{tweet_id}/quoted", summary: "Get tweets that quote-tweeted this tweet.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/context", apiPath: "/api/replies/{tweet_id}/context", summary: "Get the parent tweet + immediate replies.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/conversation-id", apiPath: "/api/replies/{tweet_id}/conversation-id", summary: "Get the conversation ID of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/replies/{tweet_id}/root", apiPath: "/api/replies/{tweet_id}/root", summary: "Get the root tweet of a conversation.", params: [{ name: "tweet_id", type: "path", required: true }] },
  // Mentions variants
  { method: "GET", path: "/api/mentions/{username}/latest", apiPath: "/api/mentions/{username}/latest", summary: "Get latest mentions.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/top", apiPath: "/api/mentions/{username}/top", summary: "Get top mentions (most liked).", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/mentions/{username}/from-verified", apiPath: "/api/mentions/{username}/from-verified", summary: "Get mentions from verified accounts.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-media", apiPath: "/api/mentions/{username}/with-media", summary: "Get mentions containing media.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-photos", apiPath: "/api/mentions/{username}/with-photos", summary: "Get mentions containing photos.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-videos", apiPath: "/api/mentions/{username}/with-videos", summary: "Get mentions containing videos.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-links", apiPath: "/api/mentions/{username}/with-links", summary: "Get mentions containing URLs.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/by-lang/{lang}", apiPath: "/api/mentions/{username}/by-lang/{lang}", summary: "Get mentions in a specific language.", params: [{ name: "username", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/since/{since}", apiPath: "/api/mentions/{username}/since/{since}", summary: "Get mentions since a date.", params: [{ name: "username", type: "path", required: true }, { name: "since", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/until/{until}", apiPath: "/api/mentions/{username}/until/{until}", summary: "Get mentions until a date.", params: [{ name: "username", type: "path", required: true }, { name: "until", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/questions", apiPath: "/api/mentions/{username}/questions", summary: "Get mentions that are questions.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/positive", apiPath: "/api/mentions/{username}/positive", summary: "Get positive mentions (heuristic).", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/negative", apiPath: "/api/mentions/{username}/negative", summary: "Get negative mentions (heuristic).", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/count", apiPath: "/api/mentions/{username}/count", summary: "Get count of recent mentions.", params: [{ name: "username", type: "path", required: true }] },
  // Trends variants
  { method: "GET", path: "/api/trends/global", apiPath: "/api/trends/global", summary: "Get global trends (woeid=1)." },
  { method: "GET", path: "/api/trends/worldwide", apiPath: "/api/trends/worldwide", summary: "Alias of /trends/global." },
  { method: "GET", path: "/api/trends/us", apiPath: "/api/trends/us", summary: "Get US trends (woeid=23424977)." },
  { method: "GET", path: "/api/trends/uk", apiPath: "/api/trends/uk", summary: "Get UK trends (woeid=23424975)." },
  { method: "GET", path: "/api/trends/japan", apiPath: "/api/trends/japan", summary: "Get Japan trends (woeid=23424956)." },
  { method: "GET", path: "/api/trends/india", apiPath: "/api/trends/india", summary: "Get India trends (woeid=23424848)." },
  { method: "GET", path: "/api/trends/brazil", apiPath: "/api/trends/brazil", summary: "Get Brazil trends (woeid=23424768)." },
  { method: "GET", path: "/api/trends/germany", apiPath: "/api/trends/germany", summary: "Get Germany trends (woeid=23424829)." },
  { method: "GET", path: "/api/trends/france", apiPath: "/api/trends/france", summary: "Get France trends (woeid=23424819)." },
  { method: "GET", path: "/api/trends/canada", apiPath: "/api/trends/canada", summary: "Get Canada trends (woeid=23424775)." },
  { method: "GET", path: "/api/trends/australia", apiPath: "/api/trends/australia", summary: "Get Australia trends (woeid=23424748)." },
  { method: "GET", path: "/api/trends/nigeria", apiPath: "/api/trends/nigeria", summary: "Get Nigeria trends (woeid=23424908)." },
  { method: "GET", path: "/api/trends/top/{n}", apiPath: "/api/trends/top/{n}", summary: "Get the top N trends.", params: [{ name: "n", type: "path", required: true }] },
  { method: "GET", path: "/api/trends/by-volume", apiPath: "/api/trends/by-volume", summary: "Get trends sorted by tweet volume (descending)." },
  // Media variants
  { method: "GET", path: "/api/media/tweet/{tweet_id}/photos", apiPath: "/api/media/tweet/{tweet_id}/photos", summary: "Get photos attached to a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/videos", apiPath: "/api/media/tweet/{tweet_id}/videos", summary: "Get videos attached to a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/gifs", apiPath: "/api/media/tweet/{tweet_id}/gifs", summary: "Get animated GIFs attached to a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/first-photo", apiPath: "/api/media/tweet/{tweet_id}/first-photo", summary: "Get the first photo of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/first-video", apiPath: "/api/media/tweet/{tweet_id}/first-video", summary: "Get the first video of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/thumbnails", apiPath: "/api/media/tweet/{tweet_id}/thumbnails", summary: "Get thumbnail URLs for all media.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/count", apiPath: "/api/media/tweet/{tweet_id}/count", summary: "Get the count of media items.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}", apiPath: "/api/media/user/{username}", summary: "Get tweets with media from a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/photos", apiPath: "/api/media/user/{username}/photos", summary: "Get tweets containing photos from a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/videos", apiPath: "/api/media/user/{username}/videos", summary: "Get tweets containing videos from a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/all-photos", apiPath: "/api/media/user/{username}/all-photos", summary: "Get all photo URLs from a user's recent tweets.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/all-videos", apiPath: "/api/media/user/{username}/all-videos", summary: "Get all video URLs from a user's recent tweets.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/avatar", apiPath: "/api/media/user/{username}/avatar", summary: "Get the avatar URL of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}/banner", apiPath: "/api/media/user/{username}/banner", summary: "Get the banner URL of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}/avatar-hd", apiPath: "/api/media/user/{username}/avatar-hd", summary: "Get HD avatar URL of a user.", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/search", apiPath: "/api/media/search", summary: "Search for tweets containing media matching a query.", params: [{ name: "q", type: "string", required: true }, { name: "type", type: "string", default: "all" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/most-viewed", apiPath: "/api/media/user/{username}/most-viewed", summary: "Get the most-viewed media tweets from a user.", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int", default: "10" }] },
  // Quotes variants
  { method: "GET", path: "/api/quotes/{tweet_id}/latest", apiPath: "/api/quotes/{tweet_id}/latest", summary: "Get latest quote tweets of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/top", apiPath: "/api/quotes/{tweet_id}/top", summary: "Get most popular quote tweets (by likes).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/by-verified", apiPath: "/api/quotes/{tweet_id}/by-verified", summary: "Get quote tweets from verified accounts only.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-media", apiPath: "/api/quotes/{tweet_id}/with-media", summary: "Get quote tweets that contain media.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-photos", apiPath: "/api/quotes/{tweet_id}/with-photos", summary: "Get quote tweets containing photos.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-videos", apiPath: "/api/quotes/{tweet_id}/with-videos", summary: "Get quote tweets containing videos.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/positive", apiPath: "/api/quotes/{tweet_id}/positive", summary: "Get positive quote tweets (heuristic).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/negative", apiPath: "/api/quotes/{tweet_id}/negative", summary: "Get negative quote tweets (heuristic).", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/by-lang/{lang}", apiPath: "/api/quotes/{tweet_id}/by-lang/{lang}", summary: "Get quote tweets in a specific language.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/count", apiPath: "/api/quotes/{tweet_id}/count", summary: "Get the quote count of a tweet.", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/since/{since}", apiPath: "/api/quotes/{tweet_id}/since/{since}", summary: "Get quote tweets since a date.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "since", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/until/{until}", apiPath: "/api/quotes/{tweet_id}/until/{until}", summary: "Get quote tweets until a date.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "until", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/oldest", apiPath: "/api/quotes/{tweet_id}/oldest", summary: "Get oldest quote tweets.", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/context", apiPath: "/api/quotes/{tweet_id}/context", summary: "Get the original tweet that this quote-tweet quotes.", params: [{ name: "tweet_id", type: "path", required: true }] },
];

function ParamList({ params }: { params?: Endpoint["params"] }) {
  if (!params || params.length === 0) {
    return (
      <span style={{ color: "var(--dim)", fontSize: 12 }}>— no params</span>
    );
  }
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {params.map((p) => (
        <code
          key={p.name}
          style={{
            fontSize: 11,
            padding: "2px 6px",
            background: "#1a1a1a",
            border: "1px solid var(--line)",
            borderRadius: 4,
            color: p.required ? "#fcd34d" : "var(--muted)",
          }}
          title={`${p.type}${p.default ? ` • default: ${p.default}` : ""}`}
        >
          {p.required ? "*" : ""}
          {p.name}
          <span style={{ color: "var(--dim)" }}>:{p.type}</span>
        </code>
      ))}
    </span>
  );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
  const playgroundHref = `/playground?path=${encodeURIComponent(ep.apiPath)}`;
  return (
    <tr style={{ borderBottom: "1px solid var(--line)" }}>
      <td style={{ padding: "12px 0", verticalAlign: "top", width: 60 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "var(--blue)",
            letterSpacing: "0.08em",
          }}
        >
          {ep.method}
        </span>
      </td>
      <td style={{ padding: "12px 12px", verticalAlign: "top" }}>
        <Link
          href={playgroundHref}
          style={{
            fontFamily: "monospace",
            fontSize: 13,
            color: "var(--text)",
            wordBreak: "break-all",
          }}
        >
          {ep.apiPath}
        </Link>
        <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 13 }}>
          {ep.summary}
        </div>
        <div style={{ marginTop: 6 }}>
          <ParamList params={ep.params} />
        </div>
      </td>
    </tr>
  );
}

export default function DocsPage() {
  const allGroups = [...GROUPS];
  if (EXTENDED_ENDPOINTS.length) {
    allGroups.push({
      name: "Extended aliases",
      tag: "Extended aliases",
      blurb:
        "Filter / shortcut aliases that the Python service exposes. They share the same shapes as the canonical routes — listed here for the playground and reference.",
      endpoints: EXTENDED_ENDPOINTS,
    });
  }

  const totalEndpoints =
    GROUPS.reduce((n, g) => n + g.endpoints.length, 0) +
    EXTENDED_ENDPOINTS.length;

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0a0a0a",
        color: "var(--text)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header
        style={{
          borderBottom: "1px solid var(--line)",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <Link
          href="/"
          className="gradient-text"
          style={{
            fontSize: 22,
            fontWeight: 800,
            textDecoration: "none",
            letterSpacing: "-0.02em",
          }}
        >
          blitzyxsc
        </Link>
        <span style={{ color: "var(--dim)", fontSize: 13 }}>/ docs</span>
        <div style={{ flex: 1 }} />
        <Link
          href="/playground"
          style={{
            fontSize: 13,
            padding: "8px 14px",
            border: "1px solid var(--line)",
            borderRadius: 8,
          }}
        >
          Playground →
        </Link>
        <Link
          href="/api/health"
          style={{ fontSize: 13, color: "var(--muted)" }}
        >
          /api/health
        </Link>
      </header>

      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "48px 24px",
          flex: 1,
          width: "100%",
        }}
      >
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            margin: "0 0 8px",
            letterSpacing: "-0.02em",
          }}
        >
          blitzyxsc API reference
        </h1>
        <p style={{ color: "var(--muted)", maxWidth: 720, lineHeight: 1.6 }}>
          Auth-free X/Twitter scraping API by{" "}
          <a
            href="https://x.com/blitzlabx"
            target="_blank"
            rel="noopener noreferrer"
          >
            @blitzlabx
          </a>
          . TypeScript / Next.js mirror of the Python FastAPI service. Every
          response includes <code>X-Powered-By: blitzyxsc</code> and{" "}
          <code>X-Author: blitzlabx</code> headers + permissive CORS.
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            margin: "32px 0",
          }}
        >
          <Stat label="Endpoints" value={String(totalEndpoints)} />
          <Stat label="Routers" value={String(GROUPS.length)} />
          <Stat label="Providers" value="4" />
          <Stat label="Auth required" value="none" />
        </div>

        <h2
          style={{
            fontSize: 14,
            color: "var(--muted)",
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            marginTop: 40,
            marginBottom: 16,
          }}
        >
          Quick start
        </h2>
        <pre
          style={{
            background: "#111",
            border: "1px solid var(--line)",
            borderRadius: 10,
            padding: 16,
            overflowX: "auto",
            fontSize: 13,
            color: "var(--muted)",
          }}
        >
          <code>{`# install + run locally
npm install
npm run dev

# build for production (Vercel)
npm run build && npm start

# health check
curl http://localhost:3000/api/health
curl http://localhost:3000/api/profile/elonmusk
curl http://localhost:3000/api/posts/20`}</code>
        </pre>

        {allGroups.map((g) => (
          <div key={g.name} style={{ marginTop: 48 }}>
            <h2
              style={{
                fontSize: 22,
                fontWeight: 700,
                margin: "0 0 6px",
              }}
            >
              {g.name}
            </h2>
            <p
              style={{
                color: "var(--muted)",
                fontSize: 13,
                margin: "0 0 16px",
                maxWidth: 720,
                lineHeight: 1.6,
              }}
            >
              {g.blurb}
            </p>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <tbody>
                {g.endpoints.map((ep) => (
                  <EndpointRow key={ep.path} ep={ep} />
                ))}
              </tbody>
            </table>
          </div>
        ))}

        <div
          style={{
            marginTop: 56,
            padding: 24,
            border: "1px solid var(--line)",
            borderRadius: 12,
            background: "#111",
          }}
        >
          <h3 style={{ margin: "0 0 8px", fontSize: 16 }}>Response shape</h3>
          <p style={{ color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
            Single-tweet responses are wrapped as <code>TweetResponse</code>,
            lists as <code>TweetListResponse</code>, profiles as{" "}
            <code>ProfileResponse</code>. Every envelope includes a{" "}
            <code>provider</code> field with <code>name</code>,{" "}
            <code>latency_ms</code>, and <code>ok</code> — telling you which
            source served the request.
          </p>
          <pre
            style={{
              marginTop: 12,
              fontSize: 12,
              color: "var(--muted)",
              overflowX: "auto",
            }}
          >
            <code>{`{
  "data": {
    "id": "20",
    "text": "just setting up my twttr",
    "author": { "username": "jack", "display_name": "jack" },
    "created_at": "2006-03-21T20:50:14Z",
    "reply_count": 18089,
    "retweet_count": 124640,
    "like_count": 309872,
    ...
  },
  "provider": { "name": "composable", "ok": true, "latency_ms": 250.35 }
}`}</code>
          </pre>
        </div>
      </section>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "24px",
          textAlign: "center",
          color: "var(--dim)",
          fontSize: 13,
        }}
      >
        v1.0.0 • by{" "}
        <a
          href="https://x.com/blitzlabx"
          target="_blank"
          rel="noopener noreferrer"
        >
          @blitzlabx
        </a>{" "}
        • MIT
      </footer>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: "1px solid var(--line)",
        borderRadius: 10,
        padding: "14px 16px",
        background: "#111",
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.12em",
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

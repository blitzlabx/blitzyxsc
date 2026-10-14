/**
 * Shared endpoint registry — used by both the docs page (server) and
 * the playground (client). Mirrors the Python router list so the two
 * deployments stay in sync.
 */

export interface EndpointParam {
  name: string;
  type: "path" | "string" | "int" | "date" | "csv";
  required?: boolean;
  default?: string;
}

export interface EndpointDef {
  method: "GET";
  path: string;
  /** path relative to the API root, e.g. /api/posts/{tweet_id} */
  apiPath: string;
  summary: string;
  params?: EndpointParam[];
  group: string;
}

export const ENDPOINT_GROUPS: { name: string; blurb: string }[] = [
  { name: "Meta", blurb: "Service health + provider registry" },
  { name: "Posts & Timeline", blurb: "Single tweets + user timelines" },
  { name: "Profile", blurb: "User profile lookups" },
  { name: "Search", blurb: "Keyword search" },
  { name: "Replies & Comments", blurb: "Conversation threads + reply trees" },
  { name: "Mentions", blurb: "Tweets that mention a user" },
  { name: "Trends", blurb: "Current trending topics" },
  { name: "Media", blurb: "Images, videos, GIFs from tweets and users" },
  { name: "Quotes", blurb: "Quote tweets" },
];

const META: EndpointDef[] = [
  { method: "GET", path: "/api/health", apiPath: "/api/health", summary: "Service health check + uptime + provider list.", group: "Meta" },
  { method: "GET", path: "/api/providers", apiPath: "/api/providers", summary: "List configured providers + their priority order.", group: "Meta" },
];

const POSTS: EndpointDef[] = [
  { method: "GET", path: "/api/posts/{tweet_id}", apiPath: "/api/posts/{tweet_id}", summary: "Get a single tweet by ID.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/user/{username}", apiPath: "/api/posts/user/{username}", summary: "Get tweets from a user's timeline.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int", default: "20" }, { name: "cursor", type: "string" }] },
  { method: "GET", path: "/api/posts/user/{username}/media", apiPath: "/api/posts/user/{username}/media", summary: "Get tweets with media from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int", default: "20" }] },
  { method: "GET", path: "/api/posts/user/{username}/photos", apiPath: "/api/posts/user/{username}/photos", summary: "Get tweets with photos from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/videos", apiPath: "/api/posts/user/{username}/videos", summary: "Get tweets with videos from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/gifs", apiPath: "/api/posts/user/{username}/gifs", summary: "Get tweets with GIFs from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/replies", apiPath: "/api/posts/user/{username}/replies", summary: "Get replies posted by a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/original", apiPath: "/api/posts/user/{username}/original", summary: "Get original (no replies/retweets) tweets from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/retweets", apiPath: "/api/posts/user/{username}/retweets", summary: "Get retweets posted by a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/quotes", apiPath: "/api/posts/user/{username}/quotes", summary: "Get quote tweets posted by a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/text-only", apiPath: "/api/posts/user/{username}/text-only", summary: "Get text-only tweets from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/pinned", apiPath: "/api/posts/user/{username}/pinned", summary: "Get a user's pinned tweet.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/raw", apiPath: "/api/posts/id/{tweet_id}/raw", summary: "Get raw tweet data.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/text", apiPath: "/api/posts/id/{tweet_id}/text", summary: "Get only the text content of a tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/author", apiPath: "/api/posts/id/{tweet_id}/author", summary: "Get the author of a tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/stats", apiPath: "/api/posts/id/{tweet_id}/stats", summary: "Get engagement stats.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/hashtags", apiPath: "/api/posts/id/{tweet_id}/hashtags", summary: "Get hashtags used in a tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/mentions", apiPath: "/api/posts/id/{tweet_id}/mentions", summary: "Get users mentioned in a tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/urls", apiPath: "/api/posts/id/{tweet_id}/urls", summary: "Get URLs contained in a tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/conversation", apiPath: "/api/posts/id/{tweet_id}/conversation", summary: "Get the conversation thread.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/quoted", apiPath: "/api/posts/id/{tweet_id}/quoted", summary: "Get the tweet quoted by this tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/id/{tweet_id}/retweeted", apiPath: "/api/posts/id/{tweet_id}/retweeted", summary: "Get the tweet retweeted by this tweet.", group: "Posts & Timeline", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/posts/ids", apiPath: "/api/posts/ids", summary: "Fetch multiple tweets by comma-separated IDs.", group: "Posts & Timeline", params: [{ name: "ids", type: "csv", required: true }] },
  { method: "GET", path: "/api/posts/by-date", apiPath: "/api/posts/by-date", summary: "Get tweets from a user within a date range.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "since", type: "date", required: true }, { name: "until", type: "date", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-language", apiPath: "/api/posts/by-language", summary: "Filter user timeline by language code.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "lang", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-hashtag", apiPath: "/api/posts/by-hashtag", summary: "Filter user timeline by hashtag.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "hashtag", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-mention", apiPath: "/api/posts/by-mention", summary: "Filter user timeline by mentioned user.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "mention", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-min-likes", apiPath: "/api/posts/by-min-likes", summary: "Tweets from a user with at least N likes.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "min_likes", type: "int", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-min-retweets", apiPath: "/api/posts/by-min-retweets", summary: "Tweets from a user with at least N retweets.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "min_retweets", type: "int", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/by-min-views", apiPath: "/api/posts/by-min-views", summary: "Tweets from a user with at least N views.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "min_views", type: "int", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/popular/{username}", apiPath: "/api/posts/popular/{username}", summary: "Most popular tweets from a user (sorted by likes).", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "100" }] },
  { method: "GET", path: "/api/posts/by-source", apiPath: "/api/posts/by-source", summary: "Tweets from a user posted via a specific source app.", group: "Posts & Timeline", params: [{ name: "username", type: "string", required: true }, { name: "source", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/sensitive/{username}", apiPath: "/api/posts/sensitive/{username}", summary: "Get sensitive tweets from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/clean/{username}", apiPath: "/api/posts/clean/{username}", summary: "Get non-sensitive tweets from a user.", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/posts/user/{username}/latest", apiPath: "/api/posts/user/{username}/latest", summary: "Latest tweets from a user (alias).", group: "Posts & Timeline", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
];

const PROFILE: EndpointDef[] = [
  { method: "GET", path: "/api/profile/{username}", apiPath: "/api/profile/{username}", summary: "Get a user's profile.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/bio", apiPath: "/api/profile/{username}/bio", summary: "Get only the bio of a user.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/avatar", apiPath: "/api/profile/{username}/avatar", summary: "Get only the avatar URL.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/banner", apiPath: "/api/profile/{username}/banner", summary: "Get only the banner URL.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/display-name", apiPath: "/api/profile/{username}/display-name", summary: "Get only the display name.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/location", apiPath: "/api/profile/{username}/location", summary: "Get only the location.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/website", apiPath: "/api/profile/{username}/website", summary: "Get only the website.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/stats", apiPath: "/api/profile/{username}/stats", summary: "Get only the stats (followers/following/tweets/likes).", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/followers", apiPath: "/api/profile/{username}/followers", summary: "Get follower count.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/following", apiPath: "/api/profile/{username}/following", summary: "Get following count.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/tweets-count", apiPath: "/api/profile/{username}/tweets-count", summary: "Get tweet count.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/likes-count", apiPath: "/api/profile/{username}/likes-count", summary: "Get like count.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/listed-count", apiPath: "/api/profile/{username}/listed-count", summary: "Get listed count.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/verified", apiPath: "/api/profile/{username}/verified", summary: "Check if a user is verified.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/protected", apiPath: "/api/profile/{username}/protected", summary: "Check if a user is protected.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/joined", apiPath: "/api/profile/{username}/joined", summary: "Get join date.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/id", apiPath: "/api/profile/{username}/id", summary: "Get internal ID of a user.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/summary", apiPath: "/api/profile/{username}/summary", summary: "Get a short text summary of a profile.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/pinned", apiPath: "/api/profile/{username}/pinned", summary: "Get the pinned tweet of a user.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/exists", apiPath: "/api/profile/{username}/exists", summary: "Check if a username exists.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/combined", apiPath: "/api/profile/{username}/combined", summary: "Get profile + recent tweets in one call.", group: "Profile", params: [{ name: "username", type: "path", required: true }, { name: "tweet_limit", type: "int", default: "10" }] },
  { method: "GET", path: "/api/profile/{username}/ratio", apiPath: "/api/profile/{username}/ratio", summary: "Get follower/following ratio.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/influence-score", apiPath: "/api/profile/{username}/influence-score", summary: "Get a basic influence score (0-100).", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/bulk", apiPath: "/api/profile/bulk", summary: "Get profiles for multiple users at once.", group: "Profile", params: [{ name: "usernames", type: "csv", required: true }] },
  { method: "GET", path: "/api/profile/{username}/age", apiPath: "/api/profile/{username}/age", summary: "Get account age in days.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/avatar-hd", apiPath: "/api/profile/{username}/avatar-hd", summary: "Get HD avatar URL.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/profile/{username}/banner-hd", apiPath: "/api/profile/{username}/banner-hd", summary: "Get HD banner URL.", group: "Profile", params: [{ name: "username", type: "path", required: true }] },
];

const SEARCH: EndpointDef[] = [
  { method: "GET", path: "/api/search", apiPath: "/api/search", summary: "Search tweets by keyword (advanced query supported).", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int", default: "20" }, { name: "sort", type: "string", default: "latest" }, { name: "cursor", type: "string" }] },
  { method: "GET", path: "/api/search/latest", apiPath: "/api/search/latest", summary: "Search latest tweets.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/top", apiPath: "/api/search/top", summary: "Search top tweets (most popular).", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/advanced", apiPath: "/api/search/advanced", summary: "Advanced search with structured filters.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "from_user", type: "string" }, { name: "to_user", type: "string" }, { name: "since", type: "date" }, { name: "until", type: "date" }, { name: "min_faves", type: "int" }, { name: "min_retweets", type: "int" }, { name: "lang", type: "string" }] },
  { method: "GET", path: "/api/search/people", apiPath: "/api/search/people", summary: "Search tweets mentioning people.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/photos", apiPath: "/api/search/photos", summary: "Search tweets containing photos.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/videos", apiPath: "/api/search/videos", summary: "Search tweets containing videos.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/news", apiPath: "/api/search/news", summary: "Search tweets containing news links.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/gifs", apiPath: "/api/search/gifs", summary: "Search tweets containing GIFs.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/links", apiPath: "/api/search/links", summary: "Search tweets containing URLs.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/questions", apiPath: "/api/search/questions", summary: "Search tweets that are questions.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/positive", apiPath: "/api/search/positive", summary: "Search tweets with positive sentiment markers.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/negative", apiPath: "/api/search/negative", summary: "Search tweets with negative sentiment markers.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/hashtag/{hashtag}", apiPath: "/api/search/hashtag/{hashtag}", summary: "Search tweets containing a hashtag.", group: "Search", params: [{ name: "hashtag", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/cashtag/{cashtag}", apiPath: "/api/search/cashtag/{cashtag}", summary: "Search tweets containing a cashtag.", group: "Search", params: [{ name: "cashtag", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/mention/{username}", apiPath: "/api/search/mention/{username}", summary: "Search tweets mentioning a user.", group: "Search", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/from/{username}", apiPath: "/api/search/from/{username}", summary: "Search tweets from a user.", group: "Search", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/to/{username}", apiPath: "/api/search/to/{username}", summary: "Search tweets directed to a user.", group: "Search", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/since/{date}", apiPath: "/api/search/since/{date}", summary: "Search tweets since a date.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "date", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/until/{date}", apiPath: "/api/search/until/{date}", summary: "Search tweets until a date.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "date", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/lang/{lang}", apiPath: "/api/search/lang/{lang}", summary: "Search tweets in a specific language.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/geocode/{geocode}", apiPath: "/api/search/geocode/{geocode}", summary: "Search tweets near a geocode.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "geocode", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/near/{place}", apiPath: "/api/search/near/{place}", summary: "Search tweets near a place name.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "place", type: "path", required: true }, { name: "within", type: "string", default: "15mi" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-faves/{min_faves}", apiPath: "/api/search/min-faves/{min_faves}", summary: "Search tweets with at least N likes.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "min_faves", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-retweets/{min_retweets}", apiPath: "/api/search/min-retweets/{min_retweets}", summary: "Search tweets with at least N retweets.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "min_retweets", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/min-replies/{min_replies}", apiPath: "/api/search/min-replies/{min_replies}", summary: "Search tweets with at least N replies.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "min_replies", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/verified", apiPath: "/api/search/verified", summary: "Search tweets from verified accounts.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/no-retweets", apiPath: "/api/search/no-retweets", summary: "Search tweets excluding retweets.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/no-replies", apiPath: "/api/search/no-replies", summary: "Search tweets excluding replies.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/safe", apiPath: "/api/search/safe", summary: "Search tweets excluding sensitive content.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/search/original", apiPath: "/api/search/original", summary: "Search only original tweets.", group: "Search", params: [{ name: "q", type: "string", required: true }, { name: "limit", type: "int" }] },
];

const REPLIES: EndpointDef[] = [
  { method: "GET", path: "/api/replies/{tweet_id}", apiPath: "/api/replies/{tweet_id}", summary: "Get replies to a tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "20" }, { name: "cursor", type: "string" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/latest", apiPath: "/api/replies/{tweet_id}/latest", summary: "Get latest replies to a tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/tree", apiPath: "/api/replies/{tweet_id}/tree", summary: "Get the full reply tree.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "50" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/count", apiPath: "/api/replies/{tweet_id}/count", summary: "Get the reply count of a tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-verified", apiPath: "/api/replies/{tweet_id}/by-verified", summary: "Replies from verified accounts only.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-author", apiPath: "/api/replies/{tweet_id}/by-author", summary: "Replies from the original tweet's author.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-followers", apiPath: "/api/replies/{tweet_id}/by-followers", summary: "Replies likely from followers.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-influencers", apiPath: "/api/replies/{tweet_id}/by-influencers", summary: "Replies from high-follower accounts.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "min_followers", type: "int", default: "10000" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-media", apiPath: "/api/replies/{tweet_id}/with-media", summary: "Replies that contain media.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-photos", apiPath: "/api/replies/{tweet_id}/with-photos", summary: "Replies that contain photos.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-videos", apiPath: "/api/replies/{tweet_id}/with-videos", summary: "Replies that contain videos.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/with-links", apiPath: "/api/replies/{tweet_id}/with-links", summary: "Replies that contain URLs.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/popular", apiPath: "/api/replies/{tweet_id}/popular", summary: "Most popular replies (by likes).", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/controversial", apiPath: "/api/replies/{tweet_id}/controversial", summary: "Replies with the most engagement.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/positive", apiPath: "/api/replies/{tweet_id}/positive", summary: "Replies with positive sentiment markers.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/negative", apiPath: "/api/replies/{tweet_id}/negative", summary: "Replies with negative sentiment markers.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/questions", apiPath: "/api/replies/{tweet_id}/questions", summary: "Replies that are questions.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/by-lang/{lang}", apiPath: "/api/replies/{tweet_id}/by-lang/{lang}", summary: "Replies in a specific language.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/oldest", apiPath: "/api/replies/{tweet_id}/oldest", summary: "Oldest replies to a tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/thread", apiPath: "/api/replies/{tweet_id}/thread", summary: "Get the conversation thread (self-replies).", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "50" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/quoted", apiPath: "/api/replies/{tweet_id}/quoted", summary: "Get tweets that quote-tweeted this tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/context", apiPath: "/api/replies/{tweet_id}/context", summary: "Parent tweet + immediate replies.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/replies/{tweet_id}/conversation-id", apiPath: "/api/replies/{tweet_id}/conversation-id", summary: "Get the conversation ID of a tweet.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/replies/{tweet_id}/root", apiPath: "/api/replies/{tweet_id}/root", summary: "Get the root tweet of a conversation.", group: "Replies & Comments", params: [{ name: "tweet_id", type: "path", required: true }] },
];

const MENTIONS: EndpointDef[] = [
  { method: "GET", path: "/api/mentions/{username}", apiPath: "/api/mentions/{username}", summary: "Get tweets mentioning a user.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int", default: "20" }, { name: "cursor", type: "string" }] },
  { method: "GET", path: "/api/mentions/{username}/latest", apiPath: "/api/mentions/{username}/latest", summary: "Get latest mentions.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/top", apiPath: "/api/mentions/{username}/top", summary: "Get top mentions (most liked).", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/mentions/{username}/from-verified", apiPath: "/api/mentions/{username}/from-verified", summary: "Get mentions from verified accounts.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-media", apiPath: "/api/mentions/{username}/with-media", summary: "Get mentions containing media.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-photos", apiPath: "/api/mentions/{username}/with-photos", summary: "Get mentions containing photos.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-videos", apiPath: "/api/mentions/{username}/with-videos", summary: "Get mentions containing videos.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/with-links", apiPath: "/api/mentions/{username}/with-links", summary: "Get mentions containing URLs.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/by-lang/{lang}", apiPath: "/api/mentions/{username}/by-lang/{lang}", summary: "Get mentions in a specific language.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/since/{since}", apiPath: "/api/mentions/{username}/since/{since}", summary: "Get mentions since a date.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "since", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/until/{until}", apiPath: "/api/mentions/{username}/until/{until}", summary: "Get mentions until a date.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "until", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/questions", apiPath: "/api/mentions/{username}/questions", summary: "Get mentions that are questions.", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/positive", apiPath: "/api/mentions/{username}/positive", summary: "Get positive mentions (heuristic).", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/negative", apiPath: "/api/mentions/{username}/negative", summary: "Get negative mentions (heuristic).", group: "Mentions", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/mentions/{username}/count", apiPath: "/api/mentions/{username}/count", summary: "Get count of recent mentions.", group: "Mentions", params: [{ name: "username", type: "path", required: true }] },
];

const TRENDS: EndpointDef[] = [
  { method: "GET", path: "/api/trends", apiPath: "/api/trends", summary: "Get current trends.", group: "Trends", params: [{ name: "woeid", type: "int" }, { name: "location", type: "string" }] },
  { method: "GET", path: "/api/trends/global", apiPath: "/api/trends/global", summary: "Get global trends (woeid=1).", group: "Trends" },
  { method: "GET", path: "/api/trends/worldwide", apiPath: "/api/trends/worldwide", summary: "Alias of /trends/global.", group: "Trends" },
  { method: "GET", path: "/api/trends/us", apiPath: "/api/trends/us", summary: "Get US trends (woeid=23424977).", group: "Trends" },
  { method: "GET", path: "/api/trends/uk", apiPath: "/api/trends/uk", summary: "Get UK trends (woeid=23424975).", group: "Trends" },
  { method: "GET", path: "/api/trends/japan", apiPath: "/api/trends/japan", summary: "Get Japan trends (woeid=23424956).", group: "Trends" },
  { method: "GET", path: "/api/trends/india", apiPath: "/api/trends/india", summary: "Get India trends (woeid=23424848).", group: "Trends" },
  { method: "GET", path: "/api/trends/brazil", apiPath: "/api/trends/brazil", summary: "Get Brazil trends (woeid=23424768).", group: "Trends" },
  { method: "GET", path: "/api/trends/germany", apiPath: "/api/trends/germany", summary: "Get Germany trends (woeid=23424829).", group: "Trends" },
  { method: "GET", path: "/api/trends/france", apiPath: "/api/trends/france", summary: "Get France trends (woeid=23424819).", group: "Trends" },
  { method: "GET", path: "/api/trends/canada", apiPath: "/api/trends/canada", summary: "Get Canada trends (woeid=23424775).", group: "Trends" },
  { method: "GET", path: "/api/trends/australia", apiPath: "/api/trends/australia", summary: "Get Australia trends (woeid=23424748).", group: "Trends" },
  { method: "GET", path: "/api/trends/nigeria", apiPath: "/api/trends/nigeria", summary: "Get Nigeria trends (woeid=23424908).", group: "Trends" },
  { method: "GET", path: "/api/trends/top/{n}", apiPath: "/api/trends/top/{n}", summary: "Get the top N trends.", group: "Trends", params: [{ name: "n", type: "path", required: true }] },
  { method: "GET", path: "/api/trends/by-volume", apiPath: "/api/trends/by-volume", summary: "Get trends sorted by tweet volume.", group: "Trends" },
];

const MEDIA: EndpointDef[] = [
  { method: "GET", path: "/api/media/tweet/{tweet_id}", apiPath: "/api/media/tweet/{tweet_id}", summary: "Get all media attached to a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/photos", apiPath: "/api/media/tweet/{tweet_id}/photos", summary: "Get photos attached to a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/videos", apiPath: "/api/media/tweet/{tweet_id}/videos", summary: "Get videos attached to a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/gifs", apiPath: "/api/media/tweet/{tweet_id}/gifs", summary: "Get GIFs attached to a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/first-photo", apiPath: "/api/media/tweet/{tweet_id}/first-photo", summary: "Get the first photo of a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/first-video", apiPath: "/api/media/tweet/{tweet_id}/first-video", summary: "Get the first video of a tweet.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/thumbnails", apiPath: "/api/media/tweet/{tweet_id}/thumbnails", summary: "Get thumbnail URLs for all media.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/tweet/{tweet_id}/count", apiPath: "/api/media/tweet/{tweet_id}/count", summary: "Get the count of media items.", group: "Media", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}", apiPath: "/api/media/user/{username}", summary: "Get tweets with media from a user.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/photos", apiPath: "/api/media/user/{username}/photos", summary: "Get tweets containing photos from a user.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/videos", apiPath: "/api/media/user/{username}/videos", summary: "Get tweets containing videos from a user.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/all-photos", apiPath: "/api/media/user/{username}/all-photos", summary: "Get all photo URLs from a user's recent tweets.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/all-videos", apiPath: "/api/media/user/{username}/all-videos", summary: "Get all video URLs from a user's recent tweets.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/avatar", apiPath: "/api/media/user/{username}/avatar", summary: "Get the avatar URL of a user.", group: "Media", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}/banner", apiPath: "/api/media/user/{username}/banner", summary: "Get the banner URL of a user.", group: "Media", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/user/{username}/avatar-hd", apiPath: "/api/media/user/{username}/avatar-hd", summary: "Get HD avatar URL of a user.", group: "Media", params: [{ name: "username", type: "path", required: true }] },
  { method: "GET", path: "/api/media/search", apiPath: "/api/media/search", summary: "Search for tweets containing media matching a query.", group: "Media", params: [{ name: "q", type: "string", required: true }, { name: "type", type: "string", default: "all" }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/media/user/{username}/most-viewed", apiPath: "/api/media/user/{username}/most-viewed", summary: "Get the most-viewed media tweets from a user.", group: "Media", params: [{ name: "username", type: "path", required: true }, { name: "limit", type: "int", default: "10" }] },
];

const QUOTES: EndpointDef[] = [
  { method: "GET", path: "/api/quotes/{tweet_id}", apiPath: "/api/quotes/{tweet_id}", summary: "Get quote tweets of a tweet.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int", default: "20" }, { name: "cursor", type: "string" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/latest", apiPath: "/api/quotes/{tweet_id}/latest", summary: "Get latest quote tweets of a tweet.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/top", apiPath: "/api/quotes/{tweet_id}/top", summary: "Get most popular quote tweets (by likes).", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }, { name: "min_likes", type: "int", default: "0" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/by-verified", apiPath: "/api/quotes/{tweet_id}/by-verified", summary: "Get quote tweets from verified accounts only.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-media", apiPath: "/api/quotes/{tweet_id}/with-media", summary: "Get quote tweets that contain media.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-photos", apiPath: "/api/quotes/{tweet_id}/with-photos", summary: "Get quote tweets containing photos.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/with-videos", apiPath: "/api/quotes/{tweet_id}/with-videos", summary: "Get quote tweets containing videos.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/positive", apiPath: "/api/quotes/{tweet_id}/positive", summary: "Get positive quote tweets (heuristic).", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/negative", apiPath: "/api/quotes/{tweet_id}/negative", summary: "Get negative quote tweets (heuristic).", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/by-lang/{lang}", apiPath: "/api/quotes/{tweet_id}/by-lang/{lang}", summary: "Get quote tweets in a specific language.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "lang", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/count", apiPath: "/api/quotes/{tweet_id}/count", summary: "Get the quote count of a tweet.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/since/{since}", apiPath: "/api/quotes/{tweet_id}/since/{since}", summary: "Get quote tweets since a date.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "since", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/until/{until}", apiPath: "/api/quotes/{tweet_id}/until/{until}", summary: "Get quote tweets until a date.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "until", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/oldest", apiPath: "/api/quotes/{tweet_id}/oldest", summary: "Get oldest quote tweets.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }, { name: "limit", type: "int" }] },
  { method: "GET", path: "/api/quotes/{tweet_id}/context", apiPath: "/api/quotes/{tweet_id}/context", summary: "Get the original tweet that this quote-tweet quotes.", group: "Quotes", params: [{ name: "tweet_id", type: "path", required: true }] },
];

export const ENDPOINTS: EndpointDef[] = [
  ...META,
  ...POSTS,
  ...PROFILE,
  ...SEARCH,
  ...REPLIES,
  ...MENTIONS,
  ...TRENDS,
  ...MEDIA,
  ...QUOTES,
];

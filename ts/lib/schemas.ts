/**
 * Unified response schemas — TypeScript interfaces mirroring the Python
 * Pydantic models in `blitzyxsc_api/schemas/models.py`. The TS and Python
 * deployments return the same JSON shape, so they are interchangeable.
 */

export interface ProviderInfo {
  name: string;
  latency_ms?: number | null;
  ok: boolean;
}

export interface MediaItem {
  /** photo | video | animated_gif */
  type: string;
  url: string;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
  thumbnail?: string | null;
  duration_ms?: number | null;
}

export interface TweetAuthor {
  id?: string | null;
  username: string;
  display_name?: string | null;
  avatar?: string | null;
  verified?: boolean | null;
}

export interface Tweet {
  id: string;
  text: string;
  author?: TweetAuthor | null;
  created_at?: string | null;
  language?: string | null;
  source?: string | null;
  reply_count?: number | null;
  retweet_count?: number | null;
  like_count?: number | null;
  quote_count?: number | null;
  bookmark_count?: number | null;
  view_count?: number | null;
  media: MediaItem[];
  urls: string[];
  hashtags: string[];
  mentions: TweetAuthor[];
  cashtags: string[];
  conversation_id?: string | null;
  in_reply_to?: string | null;
  is_quote?: boolean | null;
  quoted_tweet?: Tweet | null;
  is_retweet?: boolean | null;
  retweeted_tweet?: Tweet | null;
  url?: string | null;
  sensitive?: boolean | null;
}

export interface Profile {
  id?: string | null;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  avatar?: string | null;
  banner?: string | null;
  followers?: number | null;
  following?: number | null;
  tweets_count?: number | null;
  likes_count?: number | null;
  listed_count?: number | null;
  verified?: boolean | null;
  protected?: boolean | null;
  joined_at?: string | null;
  pinned_tweet?: Tweet | null;
}

export interface TrendLocation {
  name: string;
  woeid?: number | null;
  country?: string | null;
}

export interface Trend {
  name: string;
  url?: string | null;
  promoted_content?: boolean | null;
  query?: string | null;
  tweet_volume?: number | null;
  rank?: number | null;
}

export interface TrendResponse {
  trends: Trend[];
  as_of?: string | null;
  created_at?: string | null;
  locations: TrendLocation[];
  provider?: ProviderInfo | null;
}

export interface TweetListResponse {
  data: Tweet[];
  provider: ProviderInfo;
  count: number;
  next_cursor?: string | null;
  previous_cursor?: string | null;
}

export interface ProfileResponse {
  data: Profile;
  provider: ProviderInfo;
}

export interface TweetResponse {
  data: Tweet;
  provider: ProviderInfo;
}

export interface ErrorResponse {
  error: string;
  detail?: unknown;
  provider?: ProviderInfo | null;
}

export interface HealthResponse {
  status: string;
  brand: string;
  version: string;
  author: string;
  providers: string[];
  uptime_seconds: number;
}

export interface ProviderListItem {
  name: string;
  priority: number;
}

export interface ProviderListResponse {
  providers: ProviderListItem[];
  order: string[];
}

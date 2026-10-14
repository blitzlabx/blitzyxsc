// Package main: blitzyxsc response + entity models.
//
// Structs mirror the Python Pydantic models in
// blitzyxsc_api/schemas/models.py 1:1 so the Go server returns the same JSON
// shape as the FastAPI deployment (field names + nesting), keeping the two
// interchangeable for downstream consumers.
package main

import "time"

// ProviderInfo describes which source served a response and how long it took.
type ProviderInfo struct {
        Name      string  `json:"name"`
        Ok        bool    `json:"ok"`
        LatencyMs float64 `json:"latency_ms"`
}

// MediaItem is a single piece of media attached to a tweet.
type MediaItem struct {
        Type       string `json:"type"`
        URL        string `json:"url"`
        Alt        string `json:"alt,omitempty"`
        Width      int    `json:"width,omitempty"`
        Height     int    `json:"height,omitempty"`
        Thumbnail  string `json:"thumbnail,omitempty"`
        DurationMs int    `json:"duration_ms,omitempty"`
}

// TweetAuthor is a minimal author / mentioned-user record.
//
// ID / DisplayName / Avatar are plain `string` (no omitempty) so they always
// emit, matching the Python Optional[str] behaviour where empty values are
// shown as `""` rather than omitted. Verified uses *bool so it emits `null`
// when the upstream doesn't report a verification state.
type TweetAuthor struct {
        ID          string `json:"id"`
        Username    string `json:"username"`
        DisplayName string `json:"display_name"`
        Avatar      string `json:"avatar"`
        Verified    *bool  `json:"verified"`
}

// Tweet is the canonical tweet record returned across all providers.
//
// Pointer fields are used for nullable values so JSON marshalling emits null
// (matching the Python Pydantic Optional[...] shape).
type Tweet struct {
        ID             string        `json:"id"`
        Text           string        `json:"text"`
        Author         *TweetAuthor  `json:"author"`
        CreatedAt      *time.Time    `json:"created_at"`
        Language       *string       `json:"language"`
        Source         *string       `json:"source"`
        ReplyCount     *int          `json:"reply_count"`
        RetweetCount   *int          `json:"retweet_count"`
        LikeCount      *int          `json:"like_count"`
        QuoteCount     *int          `json:"quote_count"`
        BookmarkCount  *int          `json:"bookmark_count"`
        ViewCount      *int          `json:"view_count"`
        Media          []MediaItem   `json:"media"`
        URLs           []string      `json:"urls"`
        Hashtags       []string      `json:"hashtags"`
        Mentions       []TweetAuthor `json:"mentions"`
        Cashtags       []string      `json:"cashtags"`
        ConversationID *string       `json:"conversation_id"`
        InReplyTo      *string       `json:"in_reply_to"`
        IsQuote        *bool         `json:"is_quote"`
        QuotedTweet    *Tweet        `json:"quoted_tweet"`
        IsRetweet      *bool         `json:"is_retweet"`
        RetweetedTweet *Tweet        `json:"retweeted_tweet"`
        URL            *string       `json:"url"`
        Sensitive      *bool         `json:"sensitive"`
}

// Profile is the canonical user-profile record.
//
// Optional string fields are plain `string` (no omitempty) so empty values
// are emitted as `""` rather than omitted — matching the Python screenshot
// for /profile/elonmusk which shows `"location": ""`. Fields that are truly
// nullable (counts, joined_at, pinned_tweet) use pointers so they emit
// `null` when unset.
type Profile struct {
        ID          string     `json:"id,omitempty"`
        Username    string     `json:"username"`
        DisplayName string     `json:"display_name"`
        Bio         string     `json:"bio"`
        Location    string     `json:"location"`
        Website     string     `json:"website"`
        Avatar      string     `json:"avatar"`
        Banner      string     `json:"banner"`
        Followers   *int       `json:"followers"`
        Following   *int       `json:"following"`
        TweetsCount *int       `json:"tweets_count"`
        LikesCount  *int       `json:"likes_count"`
        ListedCount *int       `json:"listed_count"`
        Verified    *bool      `json:"verified"`
        Protected   *bool      `json:"protected"`
        JoinedAt    *time.Time `json:"joined_at"`
        PinnedTweet *Tweet     `json:"pinned_tweet"`
}

// TrendLocation is the place a trend set applies to.
type TrendLocation struct {
        Name    string `json:"name"`
        WOEID   *int   `json:"woeid"`
        Country string `json:"country,omitempty"`
}

// Trend is one entry in a trends response.
type Trend struct {
        Name            string `json:"name"`
        URL             string `json:"url,omitempty"`
        PromotedContent *bool  `json:"promoted_content"`
        Query           string `json:"query,omitempty"`
        TweetVolume     *int   `json:"tweet_volume"`
        Rank            *int   `json:"rank"`
}

// ---- envelope responses ----------------------------------------------------

// TweetResponse wraps a single tweet + provider info.
type TweetResponse struct {
        Data     Tweet        `json:"data"`
        Provider ProviderInfo `json:"provider"`
}

// TweetListResponse wraps a list of tweets + provider info + pagination cursor.
type TweetListResponse struct {
        Data          []Tweet      `json:"data"`
        Provider      ProviderInfo `json:"provider"`
        Count         int          `json:"count"`
        NextCursor    *string      `json:"next_cursor"`
        PreviousCursor *string     `json:"previous_cursor"`
}

// ProfileResponse wraps a single profile + provider info.
type ProfileResponse struct {
        Data     Profile      `json:"data"`
        Provider ProviderInfo `json:"provider"`
}

// TrendResponse wraps a list of trends + provider info.
type TrendResponse struct {
        Trends     []Trend         `json:"trends"`
        AsOf       *time.Time      `json:"as_of"`
        CreatedAt  *time.Time      `json:"created_at"`
        Locations  []TrendLocation `json:"locations"`
        Provider   *ProviderInfo   `json:"provider"`
}

// ErrorResponse is the standard error envelope returned for 4xx / 5xx.
type ErrorResponse struct {
        Error    string        `json:"error"`
        Detail   interface{}   `json:"detail,omitempty"`
        Provider *ProviderInfo `json:"provider,omitempty"`
}

// HealthResponse is returned by GET /health.
type HealthResponse struct {
        Status         string   `json:"status"`
        Brand          string   `json:"brand"`
        Version        string   `json:"version"`
        Author         string   `json:"author"`
        Providers      []string `json:"providers"`
        UptimeSeconds  float64  `json:"uptime_seconds"`
}

// ProviderListResponse is returned by GET /providers.
type ProviderListResponse struct {
        Providers []map[string]interface{} `json:"providers"`
        Order     []string                 `json:"order"`
}

// ---- helper constructors ---------------------------------------------------

// newTweetListResponse ensures Data is an empty slice (not nil) so JSON
// marshalling emits [] rather than null, matching the Python shape.
func newTweetListResponse(tweets []Tweet, info ProviderInfo) TweetListResponse {
        if tweets == nil {
                tweets = []Tweet{}
        }
        return TweetListResponse{
                Data:     tweets,
                Provider: info,
                Count:    len(tweets),
        }
}

// providerInfo is a small constructor used by the registry.
func providerInfo(name string, ok bool, latencyMs float64) ProviderInfo {
        return ProviderInfo{Name: name, Ok: ok, LatencyMs: latencyMs}
}

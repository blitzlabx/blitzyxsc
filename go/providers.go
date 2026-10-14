// Package main: blitzyxsc provider registry + multi-source router.
//
// Mirrors the Python blitzyxsc_api/providers/ package and the Node.js port
// in blitzyxsc/node/src/providers/index.js. Four auth-free providers are
// implemented, each conforming to the Provider interface below:
//
//   1. composableProvider  — https://api.fxtwitter.com (fxtwitter JSON, real UA)
//   2. syndicationProvider — https://cdn.syndication.twimg.com (Twitter embed CDN)
//   3. nitterProvider      — list of public Nitter mirrors (RSS + HTML)
//   4. rssProvider          — last-resort oEmbed + Nitter delegation
//
// The ProviderRegistry iterates providers in priority order (configurable
// via BLITZYXSC_PROVIDER_ORDER) and returns the first successful result.
package main

import (
        "context"
        "encoding/json"
        "fmt"
        "io"
        "net/http"
        "net/url"
        "regexp"
        "sort"
        "strings"
        "time"
)

// ErrUnsupported is returned by a provider method that does not implement
// the requested operation. The registry treats these the same as a generic
// ProviderError and tries the next provider.
type ErrUnsupported struct{ Provider, Method string }

func (e *ErrUnsupported) Error() string {
        return fmt.Sprintf("%s does not support %s", e.Provider, e.Method)
}

// ProviderError is returned by any provider that fails to fulfil a request.
// The registry catches these and tries the next provider in priority order.
type ProviderError struct{ Msg string }

func (e *ProviderError) Error() string { return e.Msg }

// newProviderError constructs a ProviderError with the given format args.
func newProviderError(format string, args ...interface{}) *ProviderError {
        return &ProviderError{Msg: fmt.Sprintf(format, args...)}
}

// SearchFilters holds optional search filters applied to a query.
type SearchFilters struct {
        Since       string
        Until       string
        FromUser    string
        MinFaves    int
        MinRetweets int
        Lang        string
        Near        string
}

// Provider is the interface every source implements.
type Provider interface {
        Name() string
        Health(ctx context.Context) bool

        GetTweet(ctx context.Context, tweetID string) (*Tweet, error)
        GetProfile(ctx context.Context, username string) (*Profile, error)
        GetUserTweets(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error)
        SearchTweets(ctx context.Context, query string, limit int, cursor string, sort string, filters *SearchFilters) ([]Tweet, error)
        GetReplies(ctx context.Context, tweetID string, limit int, cursor string) ([]Tweet, error)
        GetQuotes(ctx context.Context, tweetID string, limit int, cursor string) ([]Tweet, error)
        GetMentions(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error)
        GetTrends(ctx context.Context, woeid int, location string) ([]Trend, error)
}

// ---- shared HTTP helper ---------------------------------------------------

// httpClient is a singleton net/http.Client used by every provider.
// Go's http.Client is safe for concurrent use and pools connections.
var httpClient = &http.Client{
        Timeout: 30 * time.Second,
}

// fetchJSON performs a GET request with the real User-Agent header and
// decodes the response into out. Returns a ProviderError on any failure.
func fetchJSON(ctx context.Context, targetURL string, out interface{}) error {
        req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
        if err != nil {
                return newProviderError("invalid URL %s: %v", targetURL, err)
        }
        req.Header.Set("User-Agent", settings.UserAgent)
        req.Header.Set("Accept", "application/json, text/xml, */*;q=0.9")
        req.Header.Set("Accept-Language", "en-US,en;q=0.9")

        resp, err := httpClient.Do(req)
        if err != nil {
                return newProviderError("fetch %s: %v", targetURL, err)
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return newProviderError("read %s: %v", targetURL, err)
        }

        if resp.StatusCode == http.StatusForbidden {
                return newProviderError("%s returned 403 forbidden (UA blocked)", targetURL)
        }
        if resp.StatusCode >= 400 {
                return newProviderError("%s returned HTTP %d", targetURL, resp.StatusCode)
        }

        if err := json.Unmarshal(body, out); err != nil {
                // Many upstreams (Nitter RSS, syndication timeline HTML) return non-JSON
                // text — surface the raw body so callers can fall back to XML / regex.
                return &rawBodyError{body: body, err: err}
        }
        return nil
}

// rawBodyError lets callers recover the raw response body when JSON decoding
// fails (e.g. to parse XML / HTML instead).
type rawBodyError struct {
        body []byte
        err  error
}

func (e *rawBodyError) Error() string {
        return fmt.Sprintf("JSON decode failed: %v", e.err)
}

// fetchText fetches a URL and returns the raw body text (no JSON decode).
func fetchText(ctx context.Context, targetURL string) (string, int, error) {
        req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
        if err != nil {
                return "", 0, newProviderError("invalid URL %s: %v", targetURL, err)
        }
        req.Header.Set("User-Agent", settings.UserAgent)
        req.Header.Set("Accept", "application/json, text/xml, text/html, */*;q=0.9")
        req.Header.Set("Accept-Language", "en-US,en;q=0.9")

        resp, err := httpClient.Do(req)
        if err != nil {
                return "", 0, newProviderError("fetch %s: %v", targetURL, err)
        }
        defer resp.Body.Close()

        body, err := io.ReadAll(resp.Body)
        if err != nil {
                return "", resp.StatusCode, newProviderError("read %s: %v", targetURL, err)
        }
        return string(body), resp.StatusCode, nil
}

// ===========================================================================
//  ComposableProvider — fxtwitter
// ===========================================================================

// ComposableProvider hits api.fxtwitter.com — a public, auth-free JSON API
// serving both tweet and profile data. fxtwitter requires a real User-Agent
// header (it returns 403 for the default Go http.UserAgent).
type ComposableProvider struct{}

func (p *ComposableProvider) Name() string { return "composable" }

// Health probes api.fxtwitter.com to confirm reachability.
//
// Uses the /elonmusk profile endpoint as a known-good probe (the root URL
// sometimes returns slowly / times out under cold-start conditions).
func (p *ComposableProvider) Health(ctx context.Context) bool {
        ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()
        _, _, err := fetchText(ctx, settings.ComposableBaseURL+"/elonmusk")
        return err == nil
}

// GetTweet fetches a single tweet by ID via /status/{id}.
func (p *ComposableProvider) GetTweet(ctx context.Context, tweetID string) (*Tweet, error) {
        var raw map[string]interface{}
        target := fmt.Sprintf("%s/status/%s", settings.ComposableBaseURL, tweetID)
        if err := fetchJSON(ctx, target, &raw); err != nil {
                return nil, newProviderError("composable tweet %s: %v", tweetID, err)
        }
        t := objFromMap(raw["tweet"])
        if t == nil {
                return nil, newProviderError("composable tweet %s: empty response", tweetID)
        }
        tweet := ParseFxtwitterTweet(t)
        return &tweet, nil
}

// GetProfile fetches a user profile via /{username}.
//
// fxtwitter uses `followers` / `following` / `tweets` / `likes` field names
// (no `_count` suffix) and a nested `verification` object — handled by
// ParseFxtwitterProfile.
func (p *ComposableProvider) GetProfile(ctx context.Context, username string) (*Profile, error) {
        var raw map[string]interface{}
        target := fmt.Sprintf("%s/%s", settings.ComposableBaseURL, username)
        if err := fetchJSON(ctx, target, &raw); err != nil {
                return nil, newProviderError("composable profile %s: %v", username, err)
        }
        if objFromMap(raw["user"]) == nil {
                return nil, newProviderError("composable profile %s: empty response", username)
        }
        profile := ParseFxtwitterProfile(raw, username)
        return &profile, nil
}

// fxtwitter does not expose timeline / search / replies / mentions / quotes
// / trends as public JSON endpoints — these methods return ErrUnsupported so
// the registry falls back to the next provider.
func (p *ComposableProvider) GetUserTweets(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_user_tweets"}
}
func (p *ComposableProvider) SearchTweets(ctx context.Context, q string, lim int, c string, s string, f *SearchFilters) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "search_tweets"}
}
func (p *ComposableProvider) GetReplies(ctx context.Context, tweetID string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_replies"}
}
func (p *ComposableProvider) GetQuotes(ctx context.Context, tweetID string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_quotes"}
}
func (p *ComposableProvider) GetMentions(ctx context.Context, username string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_mentions"}
}
func (p *ComposableProvider) GetTrends(ctx context.Context, woeid int, loc string) ([]Trend, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_trends"}
}

// ===========================================================================
//  SyndicationProvider — Twitter embed CDN
// ===========================================================================

// SyndicationProvider hits cdn.syndication.twimg.com — Twitter's own public
// embed CDN. The /tweet-result endpoint serves tweet JSON without auth.
type SyndicationProvider struct{}

func (p *SyndicationProvider) Name() string { return "syndication" }

func (p *SyndicationProvider) Health(ctx context.Context) bool {
        ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()
        _, _, err := fetchText(ctx, settings.SyndicationBaseURL+"/")
        return err == nil
}

func (p *SyndicationProvider) GetTweet(ctx context.Context, tweetID string) (*Tweet, error) {
        var raw map[string]interface{}
        target := fmt.Sprintf("%s/tweet-result?id=%s&token=0", settings.SyndicationBaseURL, tweetID)
        if err := fetchJSON(ctx, target, &raw); err != nil {
                return nil, newProviderError("syndication tweet %s: %v", tweetID, err)
        }
        if raw == nil {
                return nil, newProviderError("syndication tweet %s: empty response", tweetID)
        }
        tweet := ParseSyndicationTweet(raw)
        return &tweet, nil
}

// syndication timeline endpoint returns HTML — not implemented (returns []).
func (p *SyndicationProvider) GetUserTweets(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_user_tweets"}
}

func (p *SyndicationProvider) GetProfile(ctx context.Context, username string) (*Profile, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_profile"}
}
func (p *SyndicationProvider) SearchTweets(ctx context.Context, q string, lim int, c string, s string, f *SearchFilters) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "search_tweets"}
}
func (p *SyndicationProvider) GetReplies(ctx context.Context, tweetID string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_replies"}
}
func (p *SyndicationProvider) GetQuotes(ctx context.Context, tweetID string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_quotes"}
}
func (p *SyndicationProvider) GetMentions(ctx context.Context, username string, lim int, c string) ([]Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_mentions"}
}
func (p *SyndicationProvider) GetTrends(ctx context.Context, woeid int, loc string) ([]Trend, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_trends"}
}

// ===========================================================================
//  NitterProvider — public Nitter mirrors
// ===========================================================================

var (
        nitterAvatarRe   = regexp.MustCompile(`data-src="([^"]+)"|<img[^>]+src="([^"]+avatar[^"]*)"`)
        nitterBannerRe   = regexp.MustCompile(`profile-banner[^"]*"([^"]+)"|cover[^"]+src="([^"]+)"`)
        nitterDisplayRe   = regexp.MustCompile(`class="profile-card-fullname"[^>]*>([^<]+)<`)
        nitterBioRe       = regexp.MustCompile(`class="profile-bio"[^>]*>([^<]+)<`)
        nitterLocRe       = regexp.MustCompile(`class="profile-location"[^>]*>([^<]+)<`)
        nitterWebsiteRe   = regexp.MustCompile(`class="profile-website"[^>]*>.*?href="([^"]+)"`)
        nitterFollowersRe = regexp.MustCompile(`"followers"[^>]*>([0-9,.]+)`)
        nitterFollowingRe = regexp.MustCompile(`"following"[^>]*>([0-9,.]+)`)
        nitterTweetsRe    = regexp.MustCompile(`"statuses"[^>]*>([0-9,.]+)`)
        nitterTrendRe     = regexp.MustCompile(`class="trend-item"[^>]*>.*?href="/search\?q=([^"]+)"[^>]*>.*?<[^>]+>([^<]+)<`)
        nitterItemBlockRe = regexp.MustCompile(`<div class="timeline-item[^"]*"[^>]*>(.*?)<div class="timeline-item`)
        nitterTweetIDRe   = regexp.MustCompile(`/status/(\d+)`)
        nitterUsernameRe  = regexp.MustCompile(`href="/([^/"]+)"[^>]*>@|username="([^"]+)"`)
        nitterTextRe      = regexp.MustCompile(`(?s)class="tweet-content[^"]*"[^>]*>(.*?)</div>`)
        nitterImgRe       = regexp.MustCompile(`data-src="([^"]+)"|src="([^"]+\.(?:jpg|png|webp)[^"]*)"`)
        nitterHashtagRe   = regexp.MustCompile(`#(\w+)`)
        nitterMentionRe   = regexp.MustCompile(`@(\w+)`)
        nitterTagStripRe  = regexp.MustCompile(`<[^>]+>`)
        nitterRSSLinkRe   = regexp.MustCompile(`<link>([^<]+)</link>`)
        nitterRSSTitleRe  = regexp.MustCompile(`<title>([^<]+)</title>`)
        nitterRSSDateRe   = regexp.MustCompile(`<pubDate>([^<]+)</pubDate>`)
        nitterRSSDescRe   = regexp.MustCompile(`(?s)<description>(.*?)</description>`)
        nitterRSSItemRe   = regexp.MustCompile(`(?s)<item>(.*?)</item>`)
)

// NitterProvider tries each configured Nitter mirror in order. RSS is the
// primary access pattern for timelines; HTML scraping handles profiles,
// replies, search, and trends.
type NitterProvider struct{}

func (p *NitterProvider) Name() string { return "nitter" }

func (p *NitterProvider) Health(ctx context.Context) bool {
        for _, base := range settings.NitterInstances {
                c, cancel := context.WithTimeout(ctx, 5*time.Second)
                _, status, err := fetchText(c, base)
                cancel()
                if err == nil && status < 500 {
                        return true
                }
        }
        return false
}

// tryInstances fetches path from each Nitter instance until one returns 200
// with a non-empty body. Returns the body text and the base URL used.
func (p *NitterProvider) tryInstances(ctx context.Context, path string) (string, string, error) {
        var lastErr error
        for _, base := range settings.NitterInstances {
                c, cancel := context.WithTimeout(ctx, time.Duration(settings.NitterTimeout)*time.Second)
                body, status, err := fetchText(c, base+path)
                cancel()
                if err == nil && status == 200 && body != "" {
                        return body, base, nil
                }
                if err != nil {
                        lastErr = err
                } else {
                        lastErr = newProviderError("%s returned HTTP %d", base+path, status)
                }
        }
        if lastErr == nil {
                lastErr = newProviderError("all Nitter instances failed for %s", path)
        }
        return "", "", lastErr
}

func (p *NitterProvider) GetTweet(ctx context.Context, tweetID string) (*Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_tweet"}
}

func (p *NitterProvider) GetProfile(ctx context.Context, username string) (*Profile, error) {
        body, base, err := p.tryInstances(ctx, "/"+username)
        if err != nil {
                // fall back to RSS as a last resort
                body, base, err = p.tryInstances(ctx, "/"+username+"/rss")
                if err != nil {
                        return nil, newProviderError("nitter profile %s: %v", username, err)
                }
                // RSS gives only tweets — build a minimal profile
                return &Profile{Username: username}, nil
        }
        _ = base
        return &Profile{
                Username:    username,
                DisplayName: extractFirst(body, nitterDisplayRe),
                Bio:         extractFirst(body, nitterBioRe),
                Location:    extractFirst(body, nitterLocRe),
                Website:     extractFirst(body, nitterWebsiteRe),
                Avatar:      extractFirstDual(body, nitterAvatarRe),
                Banner:      extractFirstDual(body, nitterBannerRe),
                Followers:   extractIntFirst(body, nitterFollowersRe),
                Following:   extractIntFirst(body, nitterFollowingRe),
                TweetsCount: extractIntFirst(body, nitterTweetsRe),
        }, nil
}

func (p *NitterProvider) GetUserTweets(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error) {
        body, base, err := p.tryInstances(ctx, "/"+username+"/rss")
        if err != nil {
                return nil, newProviderError("nitter timeline %s: %v", username, err)
        }
        tweets := ParseNitterRSS(body, base, username)
        if limit > 0 && limit < len(tweets) {
                tweets = tweets[:limit]
        }
        return tweets, nil
}

func (p *NitterProvider) SearchTweets(ctx context.Context, query string, limit int, cursor string, sort string, filters *SearchFilters) ([]Tweet, error) {
        q := buildNitterSearchURL(query, filters)
        path := "/search?f=tweets&q=" + q
        body, base, err := p.tryInstances(ctx, path)
        if err != nil {
                return nil, newProviderError("nitter search %s: %v", query, err)
        }
        tweets := ParseNitterHTMLTweets(body, base, false)
        if limit > 0 && limit < len(tweets) {
                tweets = tweets[:limit]
        }
        return tweets, nil
}

func (p *NitterProvider) GetReplies(ctx context.Context, tweetID string, limit int, cursor string) ([]Tweet, error) {
        body, base, err := p.tryInstances(ctx, "/i/status/"+tweetID)
        if err != nil {
                return nil, newProviderError("nitter replies %s: %v", tweetID, err)
        }
        tweets := ParseNitterHTMLTweets(body, base, true) // skip_first = true (main tweet)
        if limit > 0 && limit < len(tweets) {
                tweets = tweets[:limit]
        }
        return tweets, nil
}

func (p *NitterProvider) GetMentions(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error) {
        return p.SearchTweets(ctx, "@"+username, limit, cursor, "latest", nil)
}

func (p *NitterProvider) GetQuotes(ctx context.Context, tweetID string, limit int, cursor string) ([]Tweet, error) {
        return p.SearchTweets(ctx, "https://x.com/i/web/status/"+tweetID, limit, cursor, "latest", nil)
}

func (p *NitterProvider) GetTrends(ctx context.Context, woeid int, location string) ([]Trend, error) {
        body, base, err := p.tryInstances(ctx, "/trends")
        if err != nil {
                return nil, newProviderError("nitter trends: %v", err)
        }
        var trends []Trend
        matches := nitterTrendRe.FindAllStringSubmatch(body, -1)
        for i, m := range matches {
                q := m[1]
                name := strings.TrimSpace(m[2])
                rank := i + 1
                trends = append(trends, Trend{
                        Name:  name,
                        Query: q,
                        URL:   fmt.Sprintf("%s/search?q=%s", base, q),
                        Rank:  &rank,
                })
        }
        return trends, nil
}

// ---- Nitter parsers --------------------------------------------------------

// ParseNitterRSS parses a Nitter RSS feed into a slice of tweets.
func ParseNitterRSS(xmlText, base, defaultUsername string) []Tweet {
        var tweets []Tweet
        items := nitterRSSItemRe.FindAllStringSubmatch(xmlText, -1)
        for _, itemMatch := range items {
                block := itemMatch[1]
                title := strings.TrimSpace(extractFirst(block, nitterRSSTitleRe))
                link := strings.TrimSpace(extractFirst(block, nitterRSSLinkRe))
                pub := strings.TrimSpace(extractFirst(block, nitterRSSDateRe))
                desc := ""
                if m := nitterRSSDescRe.FindStringSubmatch(block); m != nil {
                        desc = strings.TrimSpace(m[1])
                }

                text := title
                authorPart := defaultUsername
                if idx := strings.Index(title, ": "); idx >= 0 {
                        authorPart = title[:idx]
                        text = title[idx+2:]
                }
                // strip CDATA wrappers
                desc = stripCDATA(desc)
                text = stripCDATA(text)

                tid := ""
                if m := nitterTweetIDRe.FindStringSubmatch(link); m != nil {
                        tid = m[1]
                }

                created := ParseTwitterDate(pub)
                var media []MediaItem
                for _, img := range nitterImgRe.FindAllStringSubmatch(desc, -1) {
                        u := img[1]
                        if u == "" {
                                u = img[2]
                        }
                        if u != "" {
                                media = append(media, MediaItem{Type: "photo", URL: u})
                        }
                }
                cleanText := strings.TrimSpace(nitterTagStripRe.ReplaceAllString(desc, ""))
                if cleanText == "" {
                        cleanText = text
                }
                var urlPtr *string
                if link != "" {
                        urlPtr = &link
                }
                // Hashtags: capture-group matches only (drop the # prefix).
                hashtags := []string{}
                for _, h := range nitterHashtagRe.FindAllStringSubmatch(text, -1) {
                        hashtags = append(hashtags, h[1])
                }
                // Mentions: capture-group matches only (drop the @ prefix).
                mentions := []TweetAuthor{}
                for _, m := range nitterMentionRe.FindAllStringSubmatch(text, -1) {
                        mentions = append(mentions, TweetAuthor{Username: m[1]})
                }
                tweet := Tweet{
                        ID:        tid,
                        Text:      cleanText,
                        Author:    &TweetAuthor{Username: authorPart},
                        CreatedAt: created,
                        Media:     orEmptyMedia(media),
                        URL:       urlPtr,
                        Hashtags:  hashtags,
                        Mentions:  mentions,
                }
                tweets = append(tweets, tweet)
        }
        if tweets == nil {
                tweets = []Tweet{}
        }
        return tweets
}

// ParseNitterHTMLTweets parses a Nitter HTML page (search results, replies,
// or profile timeline) into a slice of tweets.
func ParseNitterHTMLTweets(html, base string, skipFirst bool) []Tweet {
        var tweets []Tweet
        // Append a sentinel so the regex captures the last block too.
        html = html + `<div class="timeline-item`
        blocks := nitterItemBlockRe.FindAllStringSubmatch(html, -1)
        if skipFirst && len(blocks) > 0 {
                blocks = blocks[1:]
        }
        for _, b := range blocks {
                blk := b[1]
                tid := ""
                if m := nitterTweetIDRe.FindStringSubmatch(blk); m != nil {
                        tid = m[1]
                }
                username := ""
                if m := nitterUsernameRe.FindStringSubmatch(blk); m != nil {
                        if m[1] != "" {
                                username = m[1]
                        } else {
                                username = m[2]
                        }
                }
                text := ""
                if m := nitterTextRe.FindStringSubmatch(blk); m != nil {
                        text = strings.TrimSpace(nitterTagStripRe.ReplaceAllString(m[1], ""))
                }
                var media []MediaItem
                for _, img := range nitterImgRe.FindAllStringSubmatch(blk, -1) {
                        u := img[1]
                        if u == "" {
                                u = img[2]
                        }
                        if u != "" {
                                media = append(media, MediaItem{Type: "photo", URL: u})
                        }
                }
                tweet := Tweet{
                        ID:        tid,
                        Text:      text,
                        Author:    &TweetAuthor{Username: username},
                        Media:     orEmptyMedia(media),
                        Hashtags:  []string{},
                        Mentions:  []TweetAuthor{},
                }
                for _, h := range nitterHashtagRe.FindAllStringSubmatch(text, -1) {
                        tweet.Hashtags = append(tweet.Hashtags, h[1])
                }
                for _, m := range nitterMentionRe.FindAllStringSubmatch(text, -1) {
                        tweet.Mentions = append(tweet.Mentions, TweetAuthor{Username: m[1]})
                }
                tweets = append(tweets, tweet)
        }
        if tweets == nil {
                tweets = []Tweet{}
        }
        return tweets
}

// ---- Nitter helpers --------------------------------------------------------

func extractFirst(s string, re *regexp.Regexp) string {
        m := re.FindStringSubmatch(s)
        if m == nil {
                return ""
        }
        for _, g := range m[1:] {
                if g != "" {
                        return strings.TrimSpace(g)
                }
        }
        return ""
}

// extractFirstDual supports regexes with two capture groups (one of which
// may be empty, depending on which alternative matched).
func extractFirstDual(s string, re *regexp.Regexp) string {
        return extractFirst(s, re)
}

func extractIntFirst(s string, re *regexp.Regexp) *int {
        m := re.FindStringSubmatch(s)
        if m == nil {
                return nil
        }
        raw := m[1]
        raw = strings.ReplaceAll(raw, ",", "")
        raw = strings.ReplaceAll(raw, ".", "")
        // expand K / M suffixes
        if strings.HasSuffix(raw, "K") {
                raw = strings.TrimSuffix(raw, "K") + "000"
        }
        if strings.HasSuffix(raw, "M") {
                raw = strings.TrimSuffix(raw, "M") + "000000"
        }
        var n int
        if _, err := fmt.Sscanf(raw, "%d", &n); err != nil {
                return nil
        }
        return &n
}

func orEmptyMedia(m []MediaItem) []MediaItem {
        if m == nil {
                return []MediaItem{}
        }
        return m
}

func nitterMentionsToAuthors(names []string) []TweetAuthor {
        out := make([]TweetAuthor, 0, len(names))
        for _, n := range names {
                out = append(out, TweetAuthor{Username: n})
        }
        return out
}

func stripCDATA(s string) string {
        s = strings.TrimSpace(s)
        s = strings.TrimPrefix(s, "<![CDATA[")
        s = strings.TrimSuffix(s, "]]>")
        return s
}

// buildNitterSearchURL constructs a Nitter search query string. Pure helper —
// mirrors the Python NitterProvider._build_search_url.
func buildNitterSearchURL(query string, filters *SearchFilters) string {
        parts := []string{query}
        if filters != nil {
                if filters.Since != "" {
                        parts = append(parts, "since:"+filters.Since)
                }
                if filters.Until != "" {
                        parts = append(parts, "until:"+filters.Until)
                }
                if filters.FromUser != "" {
                        parts = append(parts, "from:"+filters.FromUser)
                }
                if filters.MinFaves > 0 {
                        parts = append(parts, fmt.Sprintf("min_faves:%d", filters.MinFaves))
                }
                if filters.MinRetweets > 0 {
                        parts = append(parts, fmt.Sprintf("min_retweets:%d", filters.MinRetweets))
                }
        }
        return url.QueryEscape(strings.Join(parts, " "))
}

// ===========================================================================
//  RSSProvider — oEmbed + Nitter delegation
// ===========================================================================

// RSSProvider is the last-resort fallback. It uses Twitter's public oEmbed
// endpoint for a minimal profile stub and delegates timeline/search/etc. to
// the Nitter provider.
type RSSProvider struct {
        Nitter *NitterProvider
}

func (p *RSSProvider) Name() string { return "rss" }

func (p *RSSProvider) Health(ctx context.Context) bool {
        c, cancel := context.WithTimeout(ctx, 5*time.Second)
        defer cancel()
        _, _, err := fetchText(c, "https://publish.twitter.com/oembed?url=https://x.com/elonmusk")
        return err == nil
}

func (p *RSSProvider) GetProfile(ctx context.Context, username string) (*Profile, error) {
        target := "https://publish.twitter.com/oembed?url=" + url.QueryEscape("https://x.com/"+username)
        var raw map[string]interface{}
        if err := fetchJSON(ctx, target, &raw); err != nil {
                return nil, newProviderError("rss profile %s: %v", username, err)
        }
        // oEmbed returns html like: <blockquote class="twitter-tweet"><p>...</p>...
        html := asString(raw["html"])
        displayName := strings.TrimSpace(strings.TrimPrefix(asString(raw["author_name"]), "@"))
        return &Profile{
                Username:    username,
                DisplayName: displayName,
                Bio:         stripHTML(html),
        }, nil
}

func (p *RSSProvider) GetTweet(ctx context.Context, tweetID string) (*Tweet, error) {
        return nil, &ErrUnsupported{Provider: p.Name(), Method: "get_tweet"}
}

func (p *RSSProvider) GetUserTweets(ctx context.Context, username string, limit int, cursor string) ([]Tweet, error) {
        if p.Nitter != nil {
                return p.Nitter.GetUserTweets(ctx, username, limit, cursor)
        }
        return []Tweet{}, nil
}
func (p *RSSProvider) SearchTweets(ctx context.Context, q string, l int, c string, s string, f *SearchFilters) ([]Tweet, error) {
        if p.Nitter != nil {
                return p.Nitter.SearchTweets(ctx, q, l, c, s, f)
        }
        return []Tweet{}, nil
}
func (p *RSSProvider) GetReplies(ctx context.Context, id string, l int, c string) ([]Tweet, error) {
        if p.Nitter != nil {
                return p.Nitter.GetReplies(ctx, id, l, c)
        }
        return []Tweet{}, nil
}
func (p *RSSProvider) GetQuotes(ctx context.Context, id string, l int, c string) ([]Tweet, error) {
        if p.Nitter != nil {
                return p.Nitter.GetQuotes(ctx, id, l, c)
        }
        return []Tweet{}, nil
}
func (p *RSSProvider) GetMentions(ctx context.Context, u string, l int, c string) ([]Tweet, error) {
        if p.Nitter != nil {
                return p.Nitter.GetMentions(ctx, u, l, c)
        }
        return []Tweet{}, nil
}
func (p *RSSProvider) GetTrends(ctx context.Context, w int, loc string) ([]Trend, error) {
        if p.Nitter != nil {
                return p.Nitter.GetTrends(ctx, w, loc)
        }
        return []Trend{}, nil
}

func stripHTML(s string) string {
        return strings.TrimSpace(nitterTagStripRe.ReplaceAllString(s, ""))
}

// ===========================================================================
//  ProviderRegistry — multi-source router with fallback
// ===========================================================================

// ProviderRegistry holds provider instances and routes calls in priority order.
type ProviderRegistry struct {
        Order     []string
        Providers map[string]Provider
}

// NewProviderRegistry constructs the default registry with all four
// providers wired up.
func NewProviderRegistry() *ProviderRegistry {
        nitter := &NitterProvider{}
        return &ProviderRegistry{
                Order: settings.ProviderOrder,
                Providers: map[string]Provider{
                        "composable":  &ComposableProvider{},
                        "syndication": &SyndicationProvider{},
                        "nitter":      nitter,
                        "rss":         &RSSProvider{Nitter: nitter},
                },
        }
}

// Names returns the registry's provider names in stable priority order.
func (r *ProviderRegistry) Names() []string {
        names := make([]string, 0, len(r.Order))
        seen := map[string]bool{}
        for _, n := range r.Order {
                if _, ok := r.Providers[n]; ok && !seen[n] {
                        names = append(names, n)
                        seen[n] = true
                }
        }
        // Append any providers that exist but aren't in ProviderOrder.
        extras := make([]string, 0)
        for n := range r.Providers {
                if !seen[n] {
                        extras = append(extras, n)
                }
        }
        sort.Strings(extras)
        return append(names, extras...)
}

// List returns provider info for the /providers endpoint.
func (r *ProviderRegistry) List() []map[string]interface{} {
        out := make([]map[string]interface{}, 0, len(r.Order))
        for i, name := range r.Order {
                if _, ok := r.Providers[name]; !ok {
                        continue
                }
                out = append(out, map[string]interface{}{
                        "name":     name,
                        "priority": i + 1,
                })
        }
        return out
}

// CallResult wraps a successful provider result + provider info.
type CallResult struct {
        Info ProviderInfo
}

// CallWithFallback dispatches the named method across providers in priority
// order. Supported method names:
//
//   - "get_tweet"            args: [tweetID]                          -> *Tweet
//   - "get_profile"          args: [username]                          -> *Profile
//   - "get_user_tweets"      args: [username, limit, cursor]          -> []Tweet
//   - "search_tweets"        args: [query, limit, cursor, sort, *SearchFilters] -> []Tweet
//   - "get_replies"          args: [tweetID, limit, cursor]           -> []Tweet
//   - "get_quotes"          args: [tweetID, limit, cursor]            -> []Tweet
//   - "get_mentions"        args: [username, limit, cursor]           -> []Tweet
//   - "get_trends"          args: [woeid, location]                    -> []Trend
//
// Returns the result + a ProviderInfo describing which provider served it,
// or the last error if every provider failed.
func (r *ProviderRegistry) CallWithFallback(ctx context.Context, method string, args ...interface{}) (interface{}, ProviderInfo, error) {
        var lastErr error
        tried := []string{}
        info := ProviderInfo{Ok: false, LatencyMs: 0}

        for _, name := range r.Order {
                p, ok := r.Providers[name]
                if !ok {
                        continue
                }
                tried = append(tried, name)
                start := time.Now()
                result, err := dispatch(ctx, p, method, args...)
                latency := float64(time.Since(start).Microseconds()) / 1000.0
                if err == nil {
                        return result, ProviderInfo{Name: name, Ok: true, LatencyMs: latency}, nil
                }
                // ErrUnsupported is silent — try next provider without surfacing it.
                if _, unsup := err.(*ErrUnsupported); !unsup {
                        lastErr = err
                } else if lastErr == nil {
                        lastErr = err
                }
                info.Name = name
                info.LatencyMs = latency
        }
        if lastErr == nil {
                lastErr = newProviderError("no provider supports %s", method)
        }
        return nil, info, fmt.Errorf("all providers failed (%s); last error: %v",
                strings.Join(tried, ","), lastErr)
}

// dispatch invokes a single provider method by name. Pure dispatcher —
// keeps CallWithFallback generic without using reflect.
func dispatch(ctx context.Context, p Provider, method string, args ...interface{}) (interface{}, error) {
        switch method {
        case "get_tweet":
                return p.GetTweet(ctx, asString(args[0]))
        case "get_profile":
                return p.GetProfile(ctx, asString(args[0]))
        case "get_user_tweets":
                limit := settings.DefaultPageSize
                if len(args) > 1 {
                        limit = toIntOrZero(args[1])
                        if limit <= 0 {
                                limit = settings.DefaultPageSize
                        }
                        if limit > settings.MaxPageSize {
                                limit = settings.MaxPageSize
                        }
                }
                cursor := ""
                if len(args) > 2 {
                        cursor = asString(args[2])
                }
                return p.GetUserTweets(ctx, asString(args[0]), limit, cursor)
        case "search_tweets":
                limit := settings.DefaultPageSize
                if len(args) > 1 {
                        limit = toIntOrZero(args[1])
                }
                cursor := ""
                if len(args) > 2 {
                        cursor = asString(args[2])
                }
                sortStr := "latest"
                if len(args) > 3 {
                        sortStr = asString(args[3])
                }
                var filters *SearchFilters
                if len(args) > 4 && args[4] != nil {
                        if f, ok := args[4].(*SearchFilters); ok {
                                filters = f
                        }
                }
                return p.SearchTweets(ctx, asString(args[0]), limit, cursor, sortStr, filters)
        case "get_replies":
                limit := settings.DefaultPageSize
                if len(args) > 1 {
                        limit = toIntOrZero(args[1])
                }
                cursor := ""
                if len(args) > 2 {
                        cursor = asString(args[2])
                }
                return p.GetReplies(ctx, asString(args[0]), limit, cursor)
        case "get_quotes":
                limit := settings.DefaultPageSize
                if len(args) > 1 {
                        limit = toIntOrZero(args[1])
                }
                cursor := ""
                if len(args) > 2 {
                        cursor = asString(args[2])
                }
                return p.GetQuotes(ctx, asString(args[0]), limit, cursor)
        case "get_mentions":
                limit := settings.DefaultPageSize
                if len(args) > 1 {
                        limit = toIntOrZero(args[1])
                }
                cursor := ""
                if len(args) > 2 {
                        cursor = asString(args[2])
                }
                return p.GetMentions(ctx, asString(args[0]), limit, cursor)
        case "get_trends":
                woeid := 1
                if len(args) > 0 {
                        woeid = toIntOrZero(args[0])
                }
                loc := ""
                if len(args) > 1 {
                        loc = asString(args[1])
                }
                return p.GetTrends(ctx, woeid, loc)
        }
        return nil, newProviderError("unknown method %s", method)
}

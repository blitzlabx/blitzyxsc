// Package main: blitzyxsc HTTP handlers.
//
// All route handlers live here, grouped by router. Each handler is small and
// uses shared helpers (writeJSON / writeError / queryInt / queryString /
// pathParam) for consistency. Larger patterns (withProfile / withTweet /
// filterUserTweets) factor out the common "fetch + filter + envelope" flow
// so individual handlers stay a few lines each.
package main

import (
        "context"
        "encoding/json"
        "fmt"
        "net/http"
        "sort"
        "strconv"
        "strings"
        "time"
)

// ---- shared helpers --------------------------------------------------------

// paramsKey is the context key for path parameters set by the router.
type paramsKey struct{}

// pathParam reads a {param} from the request context.
func pathParam(r *http.Request, name string) string {
        if p, ok := r.Context().Value(paramsKey{}).(map[string]string); ok {
                return p[name]
        }
        return ""
}

// queryInt reads an int query param, falling back to def. Bounded by min/max.
func queryInt(r *http.Request, key string, def, mn, mx int) int {
        s := strings.TrimSpace(r.URL.Query().Get(key))
        if s == "" {
                return def
        }
        n, err := strconv.Atoi(s)
        if err != nil {
                return def
        }
        if n < mn {
                n = mn
        }
        if mx > mn && n > mx {
                n = mx
        }
        return n
}

// queryString reads a string query param with a fallback default.
func queryString(r *http.Request, key, def string) string {
        s := r.URL.Query().Get(key)
        if s == "" {
                return def
        }
        return s
}

// queryBool reads a bool query param ("1", "true", "yes" → true).
func queryBool(r *http.Request, key string, def bool) bool {
        s := strings.ToLower(strings.TrimSpace(r.URL.Query().Get(key)))
        if s == "" {
                return def
        }
        return s == "1" || s == "true" || s == "yes" || s == "on"
}

// writeJSON encodes v as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, code int, v interface{}) {
        w.Header().Set("Content-Type", "application/json; charset=utf-8")
        w.WriteHeader(code)
        _ = json.NewEncoder(w).Encode(v)
}

// writeError sends an ErrorResponse envelope.
func writeError(w http.ResponseWriter, code int, msg string) {
        writeJSON(w, code, ErrorResponse{Error: msg})
}

// writeProviderError wraps an error from the registry as a 502 response.
func writeProviderError(w http.ResponseWriter, err error) {
        writeError(w, http.StatusBadGateway, err.Error())
}

// pageLimit reads the standard limit query param, bounded to [1, MaxPageSize].
func pageLimit(r *http.Request) int {
        return queryInt(r, "limit", settings.DefaultPageSize, 1, settings.MaxPageSize)
}

// cursor reads the optional cursor query param.
func cursor(r *http.Request) string {
        return queryString(r, "cursor", "")
}

// emptyListOnErr returns an empty TweetListResponse when the registry exhausts
// for list-style endpoints (mirrors the Node.js behaviour — list endpoints
// return [] rather than 502 when every provider fails).
func emptyListOnErr(info ProviderInfo, err error) (TweetListResponse, bool) {
        _ = err
        return newTweetListResponse([]Tweet{}, info), true
}

// asTweetList type-asserts a registry result into a []Tweet (defaulting to
// an empty slice when nil).
func asTweetList(res interface{}) []Tweet {
        if res == nil {
                return []Tweet{}
        }
        if list, ok := res.([]Tweet); ok {
                if list == nil {
                        return []Tweet{}
                }
                return list
        }
        return []Tweet{}
}

// asTweet type-asserts a registry result into a *Tweet.
func asTweet(res interface{}) *Tweet {
        if res == nil {
                return nil
        }
        if t, ok := res.(*Tweet); ok {
                return t
        }
        return nil
}

// asProfile type-asserts a registry result into a *Profile.
func asProfile(res interface{}) *Profile {
        if res == nil {
                return nil
        }
        if p, ok := res.(*Profile); ok {
                return p
        }
        return nil
}

// asTrends type-asserts a registry result into a []Trend.
func asTrends(res interface{}) []Trend {
        if res == nil {
                return []Trend{}
        }
        if t, ok := res.([]Trend); ok {
                if t == nil {
                        return []Trend{}
                }
                return t
        }
        return []Trend{}
}

// ---- core dispatch helpers ------------------------------------------------

// withTweet fetches a tweet by ID and passes it (with provider info) to fn,
// which returns the response body. Handles errors + writes JSON.
func withTweet(w http.ResponseWriter, r *http.Request, tweetID string, fn func(*Tweet, ProviderInfo) interface{}) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_tweet", tweetID)
        if err != nil {
                writeProviderError(w, err)
                return
        }
        t := asTweet(res)
        if t == nil {
                writeError(w, http.StatusNotFound, "tweet "+tweetID+" not found")
                return
        }
        writeJSON(w, http.StatusOK, fn(t, info))
}

// withProfile fetches a profile by username and passes it (with provider info)
// to fn, which returns the response body.
func withProfile(w http.ResponseWriter, r *http.Request, username string, fn func(*Profile, ProviderInfo) interface{}) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_profile", username)
        if err != nil {
                writeProviderError(w, err)
                return
        }
        p := asProfile(res)
        if p == nil {
                writeError(w, http.StatusNotFound, "profile "+username+" not found")
                return
        }
        writeJSON(w, http.StatusOK, fn(p, info))
}

// filterUserTweets fetches a user timeline (limit*3 buffer) and applies a
// filter to produce a TweetListResponse. Falls back to an empty list when the
// registry exhausts (matching the Python/Node list-endpoint behaviour).
func filterUserTweets(w http.ResponseWriter, r *http.Request, username string, limit int, fn func(Tweet) bool) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if fn(t) {
                        filtered = append(filtered, t)
                        if limit > 0 && len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

// fetchUserTweets is a thin wrapper around the registry returning []Tweet or
// an empty list when no provider supports the call.
func fetchUserTweets(w http.ResponseWriter, r *http.Request, username string, limit int) []Tweet {
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return nil
        }
        // when fetchUserTweets writes the response itself, the caller should return
        // immediately — signal by returning nil here.
        if res == nil {
                return []Tweet{}
        }
        return asTweetList(res)
}

// ===========================================================================
//  Meta handlers
// ===========================================================================

// handleHealth responds with the service health envelope.
func handleHealth(w http.ResponseWriter, r *http.Request) {
        resp := HealthResponse{
                Status:        "ok",
                Brand:         Brand,
                Version:       Version,
                Author:        Author,
                Providers:     registry.Names(),
                UptimeSeconds: time.Since(startTime).Seconds(),
        }
        writeJSON(w, http.StatusOK, resp)
}

// handleProviders lists configured providers + priority order.
func handleProviders(w http.ResponseWriter, r *http.Request) {
        writeJSON(w, http.StatusOK, ProviderListResponse{
                Providers: registry.List(),
                Order:     registry.Order,
        })
}

// handleProvidersHealth probes each provider live.
func handleProvidersHealth(w http.ResponseWriter, r *http.Request) {
        results := map[string]map[string]interface{}{}
        for _, name := range registry.Names() {
                p, ok := registry.Providers[name]
                if !ok {
                        continue
                }
                ctx, cancel := contextWithTimeout(r.Context(), 5*time.Second)
                healthy := p.Health(ctx)
                cancel()
                results[name] = map[string]interface{}{
                        "healthy": healthy,
                }
        }
        writeJSON(w, http.StatusOK, results)
}

// handleRoot serves a simple branded HTML landing page.
func handleRoot(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte(landingPageHTML))
}

// handleDocs serves a simple HTML docs page listing every endpoint.
func handleDocs(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Content-Type", "text/html; charset=utf-8")
        w.WriteHeader(http.StatusOK)
        _, _ = w.Write([]byte(docsPageHTML))
}

// ===========================================================================
//  Posts & Timeline handlers
// ===========================================================================

func handleGetTweet(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return TweetResponse{Data: *t, Provider: info}
        })
}

func handleGetUserTweets(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func handleGetUserTweetsMedia(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool { return len(t.Media) > 0 })
}

func handleGetUserTweetsPhotos(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "photo" {
                                return true
                        }
                }
                return false
        })
}

func handleGetUserTweetsVideos(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "video" {
                                return true
                        }
                }
                return false
        })
}

func handleGetUserTweetsReplies(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool { return t.InReplyTo != nil })
}

func handleGetUserTweetsOriginal(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                return t.InReplyTo == nil && (t.IsRetweet == nil || !*t.IsRetweet)
        })
}

func handleGetUserTweetsRetweets(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                return t.IsRetweet != nil && *t.IsRetweet
        })
}

func handleGetUserTweetsQuotes(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                return t.IsQuote != nil && *t.IsQuote
        })
}

func handleGetUserTweetsTextOnly(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool { return len(t.Media) == 0 })
}

func handleGetTweetStats(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "data": map[string]interface{}{
                                "id":              t.ID,
                                "reply_count":     t.ReplyCount,
                                "retweet_count":   t.RetweetCount,
                                "like_count":      t.LikeCount,
                                "quote_count":     t.QuoteCount,
                                "view_count":      t.ViewCount,
                                "bookmark_count":  t.BookmarkCount,
                        },
                        "provider": info,
                }
        })
}

func handleGetTweetText(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "text":     t.Text,
                        "id":       t.ID,
                        "provider": info,
                }
        })
}

func handleGetTweetHashtags(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "hashtags": t.Hashtags,
                        "provider": info,
                }
        })
}

func handleGetTweetMentions(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "mentions": t.Mentions,
                        "provider": info,
                }
        })
}

func handleGetTweetUrls(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "urls":     t.URLs,
                        "provider": info,
                }
        })
}

func handleGetTweetAuthor(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                var author *TweetAuthor
                if t.Author != nil {
                        a := *t.Author
                        author = &a
                }
                return map[string]interface{}{
                        "data":     author,
                        "provider": info,
                }
        })
}

func handleGetTweetQuoted(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                if t.QuotedTweet == nil {
                        writeError(w, http.StatusNotFound, "tweet has no quote")
                        return nil
                }
                return TweetResponse{Data: *t.QuotedTweet, Provider: info}
        })
}

func handleGetTweetConversation(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                if t.ConversationID == nil {
                        return newTweetListResponse([]Tweet{*t}, info)
                }
                res, info2, err := registry.CallWithFallback(r.Context(), "get_replies", *t.ConversationID, limit, "")
                if err != nil {
                        return newTweetListResponse([]Tweet{*t}, info)
                }
                replies := asTweetList(res)
                all := append([]Tweet{*t}, replies...)
                return newTweetListResponse(all, info2)
        })
}

func handleGetTweetsBulk(w http.ResponseWriter, r *http.Request) {
        ids := queryString(r, "ids", "")
        if ids == "" {
                writeError(w, http.StatusBadRequest, "ids query param required")
                return
        }
        parts := strings.Split(ids, ",")
        if len(parts) > 50 {
                parts = parts[:50]
        }
        results := make([]Tweet, 0, len(parts))
        var lastInfo ProviderInfo
        for _, p := range parts {
                id := strings.TrimSpace(p)
                if id == "" {
                        continue
                }
                res, info, err := registry.CallWithFallback(r.Context(), "get_tweet", id)
                if err != nil {
                        continue
                }
                if t := asTweet(res); t != nil {
                        results = append(results, *t)
                        lastInfo = info
                }
        }
        if lastInfo.Name == "" {
                lastInfo = providerInfo("multi", len(results) > 0, 0)
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(results, lastInfo))
}

func handleGetUserTweetsByDate(w http.ResponseWriter, r *http.Request) {
        username := queryString(r, "username", "")
        sinceStr := queryString(r, "since", "")
        untilStr := queryString(r, "until", "")
        if username == "" || sinceStr == "" || untilStr == "" {
                writeError(w, http.StatusBadRequest, "username, since, until query params required")
                return
        }
        sinceT, err1 := time.Parse("2006-01-02", sinceStr)
        untilT, err2 := time.Parse("2006-01-02", untilStr)
        if err1 != nil || err2 != nil {
                writeError(w, http.StatusBadRequest, "invalid date format (use YYYY-MM-DD)")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if t.CreatedAt == nil {
                        continue
                }
                ct := t.CreatedAt.UTC()
                if !ct.Before(sinceT) && !ct.After(untilT.Add(24*time.Hour-time.Second)) {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetUserTweetsByLanguage(w http.ResponseWriter, r *http.Request) {
        username := queryString(r, "username", "")
        lang := queryString(r, "lang", "")
        if username == "" || lang == "" {
                writeError(w, http.StatusBadRequest, "username, lang query params required")
                return
        }
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                return t.Language != nil && *t.Language == lang
        })
}

func handleGetUserTweetsByHashtag(w http.ResponseWriter, r *http.Request) {
        username := queryString(r, "username", "")
        hashtag := strings.ToLower(queryString(r, "hashtag", ""))
        if username == "" || hashtag == "" {
                writeError(w, http.StatusBadRequest, "username, hashtag query params required")
                return
        }
        limit := pageLimit(r)
        filterUserTweets(w, r, username, limit, func(t Tweet) bool {
                for _, h := range t.Hashtags {
                        if strings.ToLower(h) == hashtag {
                                return true
                        }
                }
                return false
        })
}

func handleGetUserTweetsPopular(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        minLikes := queryInt(r, "min_likes", 100, 0, 1<<30)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, settings.MaxPageSize, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if t.LikeCount != nil && *t.LikeCount >= minLikes {
                        filtered = append(filtered, t)
                }
        }
        sort.SliceStable(filtered, func(i, j int) bool {
                a, b := 0, 0
                if filtered[i].LikeCount != nil {
                        a = *filtered[i].LikeCount
                }
                if filtered[j].LikeCount != nil {
                        b = *filtered[j].LikeCount
                }
                return a > b
        })
        if len(filtered) > limit {
                filtered = filtered[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

// ===========================================================================
//  Search handlers
// ===========================================================================

func handleSearch(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchWithSort(w http.ResponseWriter, r *http.Request, sort string) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit, cursor(r), sort, (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchLatest(w http.ResponseWriter, r *http.Request) { handleSearchWithSort(w, r, "latest") }
func handleSearchTop(w http.ResponseWriter, r *http.Request)   { handleSearchWithSort(w, r, "top") }

func handleSearchAdvanced(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        filters := &SearchFilters{
                Since:       queryString(r, "since", ""),
                Until:       queryString(r, "until", ""),
                FromUser:    queryString(r, "from", ""),
                MinFaves:    queryInt(r, "min_faves", 0, 0, 1<<30),
                MinRetweets: queryInt(r, "min_retweets", 0, 0, 1<<30),
                Lang:        queryString(r, "lang", ""),
                Near:        queryString(r, "near", ""),
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit, cursor(r), "latest", filters)
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchMediaFilter(w http.ResponseWriter, r *http.Request, mediaType string) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit*2, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                for _, m := range t.Media {
                        if mediaType == "" || m.Type == mediaType {
                                filtered = append(filtered, t)
                                break
                        }
                }
                if len(filtered) >= limit {
                        break
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleSearchPhotos(w http.ResponseWriter, r *http.Request) { handleSearchMediaFilter(w, r, "photo") }
func handleSearchVideos(w http.ResponseWriter, r *http.Request) { handleSearchMediaFilter(w, r, "video") }
func handleSearchNews(w http.ResponseWriter, r *http.Request) {
        // "news" = tweets containing a link
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit*2, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if len(t.URLs) > 0 {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleSearchPrefixed(w http.ResponseWriter, r *http.Request, prefix string) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        full := prefix + q
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchHashtag(w http.ResponseWriter, r *http.Request) {
        handleSearchPrefixed(w, r, "#")
}
func handleSearchCashtag(w http.ResponseWriter, r *http.Request) {
        handleSearchPrefixed(w, r, "$")
}
func handleSearchMention(w http.ResponseWriter, r *http.Request) {
        handleSearchPrefixed(w, r, "@")
}

func handleSearchFrom(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        q := queryString(r, "q", "")
        full := "from:" + username
        if q != "" {
                full = q + " from:" + username
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchTo(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        q := queryString(r, "q", "")
        full := "to:" + username
        if q != "" {
                full = q + " to:" + username
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchWithFilter(w http.ResponseWriter, r *http.Request, build func(q string) *SearchFilters) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        filters := build(q)
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", filters.Since+filters.Until+filters.FromUser, limit, cursor(r), "latest", filters)
        // The above query is intentionally broad — most filters are applied by the
        // Nitter search query string built by buildNitterSearchURL.
        _ = q
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchSince(w http.ResponseWriter, r *http.Request) {
        date := pathParam(r, "date")
        q := queryString(r, "q", "")
        full := q + " since:" + date
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{Since: date})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchUntil(w http.ResponseWriter, r *http.Request) {
        date := pathParam(r, "date")
        q := queryString(r, "q", "")
        full := q + " until:" + date
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{Until: date})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchLang(w http.ResponseWriter, r *http.Request) {
        lang := pathParam(r, "lang")
        q := queryString(r, "q", "")
        full := q + " lang:" + lang
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{Lang: lang})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchNear(w http.ResponseWriter, r *http.Request) {
        place := pathParam(r, "place")
        q := queryString(r, "q", "")
        full := q + " near:" + place
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{Near: place})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchMinFaves(w http.ResponseWriter, r *http.Request) {
        minFavesStr := pathParam(r, "min_faves")
        minFaves, _ := strconv.Atoi(minFavesStr)
        q := queryString(r, "q", "")
        full := q + " min_faves:" + minFavesStr
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{MinFaves: minFaves})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchMinRetweets(w http.ResponseWriter, r *http.Request) {
        minRTStr := pathParam(r, "min_retweets")
        minRT, _ := strconv.Atoi(minRTStr)
        q := queryString(r, "q", "")
        full := q + " min_retweets:" + minRTStr
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", &SearchFilters{MinRetweets: minRT})
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchVerified(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        full := q + " filter:verified"
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchNoRetweets(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        full := q + " -filter:retweets"
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchNoReplies(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        full := q + " -filter:replies"
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchSafe(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        full := q + " filter:safe"
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleSearchOriginal(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        full := q + " -filter:retweets -filter:replies"
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", full, limit, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

// ===========================================================================
//  Profile handlers
// ===========================================================================

func handleGetProfile(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return ProfileResponse{Data: *p, Provider: info}
        })
}

func handleGetProfileBio(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"bio": p.Bio, "provider": info}
        })
}

func handleGetProfileAvatar(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"avatar": p.Avatar, "provider": info}
        })
}

func handleGetProfileBanner(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"banner": p.Banner, "provider": info}
        })
}

func handleGetProfileDisplayName(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"display_name": p.DisplayName, "provider": info}
        })
}

func handleGetProfileLocation(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"location": p.Location, "provider": info}
        })
}

func handleGetProfileWebsite(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"website": p.Website, "provider": info}
        })
}

func handleGetProfileStats(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "data": map[string]interface{}{
                                "followers":     p.Followers,
                                "following":      p.Following,
                                "tweets_count":   p.TweetsCount,
                                "likes_count":    p.LikesCount,
                                "listed_count":   p.ListedCount,
                        },
                        "provider": info,
                }
        })
}

func handleGetProfileFollowers(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"followers": p.Followers, "provider": info}
        })
}

func handleGetProfileFollowing(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"following": p.Following, "provider": info}
        })
}

func handleGetProfileVerified(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"verified": p.Verified, "provider": info}
        })
}

func handleGetProfileProtected(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"protected": p.Protected, "provider": info}
        })
}

func handleGetProfileJoined(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"joined_at": p.JoinedAt, "provider": info}
        })
}

func handleGetProfileID(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"id": p.ID, "provider": info}
        })
}

func handleGetProfileSummary(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                lines := []string{fmt.Sprintf("%s (@%s)", orDefault(p.DisplayName, p.Username), p.Username)}
                if p.Verified != nil && *p.Verified {
                        lines = append(lines, "Verified account")
                }
                if p.Bio != "" {
                        lines = append(lines, p.Bio)
                }
                if p.Location != "" {
                        lines = append(lines, "Location: "+p.Location)
                }
                if p.Website != "" {
                        lines = append(lines, "Website: "+p.Website)
                }
                if p.Followers != nil {
                        lines = append(lines, fmt.Sprintf("Followers: %d", *p.Followers))
                }
                if p.Following != nil {
                        lines = append(lines, fmt.Sprintf("Following: %d", *p.Following))
                }
                if p.TweetsCount != nil {
                        lines = append(lines, fmt.Sprintf("Tweets: %d", *p.TweetsCount))
                }
                return map[string]interface{}{
                        "summary":  strings.Join(lines, "\n"),
                        "provider": info,
                }
        })
}

func handleGetProfileRatio(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                followers, following := 0, 0
                if p.Followers != nil {
                        followers = *p.Followers
                }
                if p.Following != nil {
                        following = *p.Following
                }
                var ratio *float64
                if following > 0 {
                        r := float64(followers) / float64(following)
                        r = roundFloat(r, 4)
                        ratio = &r
                }
                return map[string]interface{}{
                        "ratio":     ratio,
                        "followers": followers,
                        "following": following,
                        "provider":  info,
                }
        })
}

func handleGetProfileInfluenceScore(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                f, fo, t := 0, 0, 0
                if p.Followers != nil {
                        f = *p.Followers
                }
                if p.Following != nil {
                        fo = *p.Following
                }
                if p.TweetsCount != nil {
                        t = *p.TweetsCount
                }
                bonus := 0.0
                if p.Verified != nil && *p.Verified {
                        bonus = 10
                }
                score := float64(f)*0.0005 + float64(t)*0.001 + bonus
                if score > 100 {
                        score = 100
                }
                score = roundFloat(score, 2)
                return map[string]interface{}{
                        "score":     score,
                        "followers": f,
                        "following": fo,
                        "tweets":    t,
                        "verified":  p.Verified,
                        "provider":  info,
                }
        })
}

func handleGetProfileCombined(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        tweetLimit := queryInt(r, "tweet_limit", 10, 1, 50)
        res, _, err := registry.CallWithFallback(r.Context(), "get_profile", username)
        if err != nil {
                writeProviderError(w, err)
                return
        }
        p := asProfile(res)
        if p == nil {
                writeError(w, http.StatusNotFound, "profile "+username+" not found")
                return
        }
        res2, info2, err2 := registry.CallWithFallback(r.Context(), "get_user_tweets", username, tweetLimit, "")
        var tweets []Tweet
        if err2 == nil {
                tweets = asTweetList(res2)
        } else {
                tweets = []Tweet{}
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "profile":  p,
                "tweets":   tweets,
                "provider": info2,
        })
}

func handleGetProfileExists(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        res, info, err := registry.CallWithFallback(r.Context(), "get_profile", username)
        exists := err == nil && asProfile(res) != nil
        var infoPtr *ProviderInfo
        if err == nil {
                infoPtr = &info
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "exists":   exists,
                "username": username,
                "provider": infoPtr,
        })
}

func handleGetProfilesBulk(w http.ResponseWriter, r *http.Request) {
        usernames := queryString(r, "usernames", "")
        if usernames == "" {
                writeError(w, http.StatusBadRequest, "usernames query param required")
                return
        }
        parts := strings.Split(usernames, ",")
        if len(parts) > 20 {
                parts = parts[:20]
        }
        results := make([]Profile, 0, len(parts))
        var lastInfo ProviderInfo
        for _, u := range parts {
                uname := strings.TrimSpace(u)
                if uname == "" {
                        continue
                }
                res, info, err := registry.CallWithFallback(r.Context(), "get_profile", uname)
                if err != nil {
                        continue
                }
                if p := asProfile(res); p != nil {
                        results = append(results, *p)
                        lastInfo = info
                }
        }
        var infoPtr *ProviderInfo
        if lastInfo.Name != "" {
                infoPtr = &lastInfo
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "data":     results,
                "count":    len(results),
                "provider": infoPtr,
        })
}

// ===========================================================================
//  Replies handlers
// ===========================================================================

func handleGetReplies(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleGetRepliesLatest(w http.ResponseWriter, r *http.Request) { handleGetReplies(w, r) }

func handleGetRepliesTree(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        // "tree" = same data, but we'd organize by thread — for now return as-is.
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleGetRepliesCount(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, 200, "")
        if err != nil {
                writeJSON(w, http.StatusOK, map[string]interface{}{
                        "count":    0,
                        "provider": info,
                })
                return
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "count":    len(asTweetList(res)),
                "provider": info,
        })
}

func handleGetRepliesByVerified(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if t.Author != nil && t.Author.Verified != nil && *t.Author.Verified {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetRepliesByAuthor(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        author := queryString(r, "username", "")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if t.Author != nil && strings.EqualFold(t.Author.Username, author) {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetRepliesWithMedia(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if len(t.Media) > 0 {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetRepliesWithPhotos(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                for _, m := range t.Media {
                        if m.Type == "photo" {
                                filtered = append(filtered, t)
                                break
                        }
                }
                if len(filtered) >= limit {
                        break
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetRepliesPopular(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, 200, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        sort.SliceStable(tweets, func(i, j int) bool {
                a, b := 0, 0
                if tweets[i].LikeCount != nil {
                        a = *tweets[i].LikeCount
                }
                if tweets[j].LikeCount != nil {
                        b = *tweets[j].LikeCount
                }
                return a > b
        })
        if len(tweets) > limit {
                tweets = tweets[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func handleGetRepliesControversial(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, 200, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        sort.SliceStable(tweets, func(i, j int) bool {
                a, b := 0, 0
                if tweets[i].ReplyCount != nil {
                        a = *tweets[i].ReplyCount
                }
                if tweets[j].ReplyCount != nil {
                        b = *tweets[j].ReplyCount
                }
                return a > b
        })
        if len(tweets) > limit {
                tweets = tweets[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func handleGetRepliesThread(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        // "thread" = self-replies by the original author. We don't have an author
        // without first fetching the root tweet — for now return regular replies.
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleGetRepliesQuoted(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_replies", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if t.IsQuote != nil && *t.IsQuote {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetRepliesContext(w http.ResponseWriter, r *http.Request) {
        handleGetReplies(w, r)
}

func handleGetRepliesConversationID(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "conversation_id": t.ConversationID,
                        "tweet_id":         t.ID,
                        "provider":         info,
                }
        })
}

func handleGetRepliesRoot(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                rootID := t.ID
                if t.ConversationID != nil {
                        rootID = *t.ConversationID
                }
                return map[string]interface{}{
                        "root_id":  rootID,
                        "tweet_id": t.ID,
                        "provider": info,
                }
        })
}

// ===========================================================================
//  Mentions handlers
// ===========================================================================

func handleGetMentions(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_mentions", username, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleGetMentionsLatest(w http.ResponseWriter, r *http.Request) { handleGetMentions(w, r) }
func handleGetMentionsTop(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_mentions", username, 200, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        sort.SliceStable(tweets, func(i, j int) bool {
                a, b := 0, 0
                if tweets[i].LikeCount != nil {
                        a = *tweets[i].LikeCount
                }
                if tweets[j].LikeCount != nil {
                        b = *tweets[j].LikeCount
                }
                return a > b
        })
        if len(tweets) > limit {
                tweets = tweets[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func filterMentions(w http.ResponseWriter, r *http.Request, username string, limit int, fn func(Tweet) bool) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_mentions", username, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if fn(t) {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetMentionsFromVerified(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                return t.Author != nil && t.Author.Verified != nil && *t.Author.Verified
        })
}

func handleGetMentionsWithMedia(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool { return len(t.Media) > 0 })
}

func handleGetMentionsWithPhotos(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "photo" {
                                return true
                        }
                }
                return false
        })
}

func handleGetMentionsWithVideos(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "video" {
                                return true
                        }
                }
                return false
        })
}

func handleGetMentionsWithLinks(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool { return len(t.URLs) > 0 })
}

func handleGetMentionsByLang(w http.ResponseWriter, r *http.Request) {
        lang := pathParam(r, "lang")
        username := queryString(r, "username", "")
        if username == "" {
                writeError(w, http.StatusBadRequest, "username query param required")
                return
        }
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                return t.Language != nil && *t.Language == lang
        })
}

func handleGetMentionsSince(w http.ResponseWriter, r *http.Request) {
        username := queryString(r, "username", "")
        if username == "" {
                writeError(w, http.StatusBadRequest, "username query param required")
                return
        }
        since := pathParam(r, "since")
        sinceT, err := time.Parse("2006-01-02", since)
        if err != nil {
                writeError(w, http.StatusBadRequest, "invalid since date (YYYY-MM-DD)")
                return
        }
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                return t.CreatedAt != nil && !t.CreatedAt.Before(sinceT)
        })
}

func handleGetMentionsUntil(w http.ResponseWriter, r *http.Request) {
        username := queryString(r, "username", "")
        if username == "" {
                writeError(w, http.StatusBadRequest, "username query param required")
                return
        }
        until := pathParam(r, "until")
        untilT, err := time.Parse("2006-01-02", until)
        if err != nil {
                writeError(w, http.StatusBadRequest, "invalid until date (YYYY-MM-DD)")
                return
        }
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                return t.CreatedAt != nil && t.CreatedAt.Before(untilT.Add(24*time.Hour))
        })
}

func handleGetMentionsQuestions(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                return strings.Contains(t.Text, "?")
        })
}

func handleGetMentionsPositive(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        positives := []string{"❤", "💜", "good", "great", "amazing", "love", "fantastic", "🔥", "👍"}
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                low := strings.ToLower(t.Text)
                for _, p := range positives {
                        if strings.Contains(low, p) {
                                return true
                        }
                }
                return false
        })
}

func handleGetMentionsNegative(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        negatives := []string{"bad", "terrible", "hate", "awful", "worst", "👎", "😡"}
        filterMentions(w, r, username, limit, func(t Tweet) bool {
                low := strings.ToLower(t.Text)
                for _, n := range negatives {
                        if strings.Contains(low, n) {
                                return true
                        }
                }
                return false
        })
}

func handleGetMentionsCount(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        res, info, err := registry.CallWithFallback(r.Context(), "get_mentions", username, 200, "")
        count := 0
        if err == nil {
                count = len(asTweetList(res))
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "count":    count,
                "provider": info,
        })
}

// ===========================================================================
//  Trends handlers
// ===========================================================================

func handleGetTrends(w http.ResponseWriter, r *http.Request) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_trends", 1, "")
        if err != nil {
                writeJSON(w, http.StatusOK, TrendResponse{
                        Trends:    []Trend{},
                        Locations: []TrendLocation{},
                        Provider:  &info,
                })
                return
        }
        writeJSON(w, http.StatusOK, TrendResponse{
                Trends:    asTrends(res),
                Locations: []TrendLocation{},
                Provider:  &info,
        })
}

func handleGetTrendsByLocation(w http.ResponseWriter, r *http.Request, location string, woeid int) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_trends", woeid, location)
        if err != nil {
                writeJSON(w, http.StatusOK, TrendResponse{
                        Trends:    []Trend{},
                        Locations:  []TrendLocation{{Name: location}},
                        Provider:  &info,
                })
                return
        }
        now := time.Now().UTC()
        writeJSON(w, http.StatusOK, TrendResponse{
                Trends:   asTrends(res),
                AsOf:     &now,
                Provider: &info,
                Locations: []TrendLocation{{Name: location, WOEID: &woeid}},
        })
}

func handleGetTrendsGlobal(w http.ResponseWriter, r *http.Request)   { handleGetTrendsByLocation(w, r, "Worldwide", 1) }
func handleGetTrendsUS(w http.ResponseWriter, r *http.Request)       { handleGetTrendsByLocation(w, r, "United States", 23424977) }
func handleGetTrendsUK(w http.ResponseWriter, r *http.Request)       { handleGetTrendsByLocation(w, r, "United Kingdom", 23424975) }
func handleGetTrendsJapan(w http.ResponseWriter, r *http.Request)    { handleGetTrendsByLocation(w, r, "Japan", 23424856) }
func handleGetTrendsIndia(w http.ResponseWriter, r *http.Request)     { handleGetTrendsByLocation(w, r, "India", 23424848) }
func handleGetTrendsBrazil(w http.ResponseWriter, r *http.Request)   { handleGetTrendsByLocation(w, r, "Brazil", 23424762) }
func handleGetTrendsGermany(w http.ResponseWriter, r *http.Request)  { handleGetTrendsByLocation(w, r, "Germany", 23424829) }
func handleGetTrendsFrance(w http.ResponseWriter, r *http.Request)   { handleGetTrendsByLocation(w, r, "France", 23424819) }
func handleGetTrendsCanada(w http.ResponseWriter, r *http.Request)   { handleGetTrendsByLocation(w, r, "Canada", 23424775) }
func handleGetTrendsAustralia(w http.ResponseWriter, r *http.Request) { handleGetTrendsByLocation(w, r, "Australia", 23424748) }
func handleGetTrendsNigeria(w http.ResponseWriter, r *http.Request)  { handleGetTrendsByLocation(w, r, "Nigeria", 23424908) }

func handleGetTrendsTopN(w http.ResponseWriter, r *http.Request) {
        nStr := pathParam(r, "n")
        n, err := strconv.Atoi(nStr)
        if err != nil || n <= 0 {
                n = 10
        }
        res, info, err := registry.CallWithFallback(r.Context(), "get_trends", 1, "")
        if err != nil {
                writeJSON(w, http.StatusOK, TrendResponse{
                        Trends:   []Trend{},
                        Provider: &info,
                })
                return
        }
        trends := asTrends(res)
        if len(trends) > n {
                trends = trends[:n]
        }
        writeJSON(w, http.StatusOK, TrendResponse{
                Trends:   trends,
                Provider: &info,
        })
}

func handleGetTrendsByVolume(w http.ResponseWriter, r *http.Request) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_trends", 1, "")
        if err != nil {
                writeJSON(w, http.StatusOK, TrendResponse{
                        Trends:   []Trend{},
                        Provider: &info,
                })
                return
        }
        trends := asTrends(res)
        sort.SliceStable(trends, func(i, j int) bool {
                a, b := 0, 0
                if trends[i].TweetVolume != nil {
                        a = *trends[i].TweetVolume
                }
                if trends[j].TweetVolume != nil {
                        b = *trends[j].TweetVolume
                }
                return a > b
        })
        writeJSON(w, http.StatusOK, TrendResponse{
                Trends:   trends,
                Provider: &info,
        })
}

// ===========================================================================
//  Media handlers
// ===========================================================================

func handleGetMediaTweet(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "data":     t.Media,
                        "count":    len(t.Media),
                        "provider": info,
                }
        })
}

func handleGetMediaTweetByType(w http.ResponseWriter, r *http.Request, mediaType string) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                filtered := make([]MediaItem, 0)
                for _, m := range t.Media {
                        if m.Type == mediaType {
                                filtered = append(filtered, m)
                        }
                }
                return map[string]interface{}{
                        "data":     filtered,
                        "count":    len(filtered),
                        "provider": info,
                }
        })
}

func handleGetMediaTweetPhotos(w http.ResponseWriter, r *http.Request)  { handleGetMediaTweetByType(w, r, "photo") }
func handleGetMediaTweetVideos(w http.ResponseWriter, r *http.Request) { handleGetMediaTweetByType(w, r, "video") }
func handleGetMediaTweetGifs(w http.ResponseWriter, r *http.Request)   { handleGetMediaTweetByType(w, r, "animated_gif") }

func handleGetMediaTweetFirstPhoto(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                for _, m := range t.Media {
                        if m.Type == "photo" {
                                return map[string]interface{}{"photo": m, "provider": info}
                        }
                }
                writeError(w, http.StatusNotFound, "no photo found")
                return nil
        })
}

func handleGetMediaTweetFirstVideo(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                for _, m := range t.Media {
                        if m.Type == "video" || m.Type == "animated_gif" {
                                return map[string]interface{}{"video": m, "provider": info}
                        }
                }
                writeError(w, http.StatusNotFound, "no video found")
                return nil
        })
}

func handleGetMediaTweetThumbnails(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                thumbs := make([]string, 0, len(t.Media))
                for _, m := range t.Media {
                        if m.Thumbnail != "" {
                                thumbs = append(thumbs, m.Thumbnail)
                        } else if m.URL != "" {
                                thumbs = append(thumbs, m.URL)
                        }
                }
                return map[string]interface{}{
                        "thumbnails": thumbs,
                        "count":      len(thumbs),
                        "provider":   info,
                }
        })
}

func handleGetMediaTweetCount(w http.ResponseWriter, r *http.Request) {
        id := pathParam(r, "tweet_id")
        withTweet(w, r, id, func(t *Tweet, info ProviderInfo) interface{} {
                return map[string]interface{}{
                        "count":    len(t.Media),
                        "provider": info,
                }
        })
}

func handleGetMediaUser(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        media := make([]MediaItem, 0)
        for _, t := range tweets {
                media = append(media, t.Media...)
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "data":     media,
                "count":    len(media),
                "provider": info,
        })
}

func handleGetMediaUserByType(w http.ResponseWriter, r *http.Request, mediaType string) {
        username := pathParam(r, "username")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        media := make([]MediaItem, 0)
        for _, t := range tweets {
                for _, m := range t.Media {
                        if m.Type == mediaType {
                                media = append(media, m)
                        }
                }
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "data":     media,
                "count":    len(media),
                "provider": info,
        })
}

func handleGetMediaUserPhotos(w http.ResponseWriter, r *http.Request)     { handleGetMediaUserByType(w, r, "photo") }
func handleGetMediaUserVideos(w http.ResponseWriter, r *http.Request)     { handleGetMediaUserByType(w, r, "video") }
func handleGetMediaUserAllPhotos(w http.ResponseWriter, r *http.Request)  { handleGetMediaUserByType(w, r, "photo") }
func handleGetMediaUserAllVideos(w http.ResponseWriter, r *http.Request)  { handleGetMediaUserByType(w, r, "video") }

func handleGetMediaUserAvatar(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"avatar": p.Avatar, "provider": info}
        })
}

func handleGetMediaUserBanner(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                return map[string]interface{}{"banner": p.Banner, "provider": info}
        })
}

func handleGetMediaUserAvatarHD(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        withProfile(w, r, username, func(p *Profile, info ProviderInfo) interface{} {
                hd := p.Avatar
                if hd != "" {
                        hd = strings.ReplaceAll(hd, "_normal.", ".")
                        hd = strings.ReplaceAll(hd, "_400x400.", ".")
                }
                return map[string]interface{}{"avatar_hd": hd, "provider": info}
        })
}

func handleGetMediaSearch(w http.ResponseWriter, r *http.Request) {
        q := queryString(r, "q", "")
        if q == "" {
                writeError(w, http.StatusBadRequest, "q query param required")
                return
        }
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "search_tweets", q, limit*2, cursor(r), "latest", (*SearchFilters)(nil))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        media := make([]MediaItem, 0)
        for _, t := range tweets {
                media = append(media, t.Media...)
        }
        if len(media) > limit {
                media = media[:limit]
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "data":     media,
                "count":    len(media),
                "provider": info,
        })
}

func handleGetMediaUserMostViewed(w http.ResponseWriter, r *http.Request) {
        username := pathParam(r, "username")
        limit := queryInt(r, "limit", 5, 1, 50)
        res, info, err := registry.CallWithFallback(r.Context(), "get_user_tweets", username, settings.MaxPageSize, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0)
        for _, t := range tweets {
                if len(t.Media) > 0 {
                        filtered = append(filtered, t)
                }
        }
        sort.SliceStable(filtered, func(i, j int) bool {
                a, b := 0, 0
                if filtered[i].ViewCount != nil {
                        a = *filtered[i].ViewCount
                }
                if filtered[j].ViewCount != nil {
                        b = *filtered[j].ViewCount
                }
                return a > b
        })
        if len(filtered) > limit {
                filtered = filtered[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

// ===========================================================================
//  Quotes handlers
// ===========================================================================

func handleGetQuotes(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, limit, cursor(r))
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(asTweetList(res), info))
}

func handleGetQuotesLatest(w http.ResponseWriter, r *http.Request) { handleGetQuotes(w, r) }

func handleGetQuotesTop(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        res, info, err := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, 200, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        sort.SliceStable(tweets, func(i, j int) bool {
                a, b := 0, 0
                if tweets[i].LikeCount != nil {
                        a = *tweets[i].LikeCount
                }
                if tweets[j].LikeCount != nil {
                        b = *tweets[j].LikeCount
                }
                return a > b
        })
        if len(tweets) > limit {
                tweets = tweets[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func filterQuotes(w http.ResponseWriter, r *http.Request, tweetID string, limit int, fn func(Tweet) bool) {
        res, info, err := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, limit*3, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        filtered := make([]Tweet, 0, limit)
        for _, t := range tweets {
                if fn(t) {
                        filtered = append(filtered, t)
                        if len(filtered) >= limit {
                                break
                        }
                }
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(filtered, info))
}

func handleGetQuotesByVerified(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                return t.Author != nil && t.Author.Verified != nil && *t.Author.Verified
        })
}

func handleGetQuotesWithMedia(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool { return len(t.Media) > 0 })
}

func handleGetQuotesWithPhotos(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "photo" {
                                return true
                        }
                }
                return false
        })
}

func handleGetQuotesWithVideos(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                for _, m := range t.Media {
                        if m.Type == "video" {
                                return true
                        }
                }
                return false
        })
}

func handleGetQuotesPositive(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        positives := []string{"❤", "💜", "good", "great", "amazing", "love", "fantastic", "🔥", "👍"}
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                low := strings.ToLower(t.Text)
                for _, p := range positives {
                        if strings.Contains(low, p) {
                                return true
                        }
                }
                return false
        })
}

func handleGetQuotesNegative(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := pageLimit(r)
        negatives := []string{"bad", "terrible", "hate", "awful", "worst", "👎", "😡"}
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                low := strings.ToLower(t.Text)
                for _, n := range negatives {
                        if strings.Contains(low, n) {
                                return true
                        }
                }
                return false
        })
}

func handleGetQuotesByLang(w http.ResponseWriter, r *http.Request) {
        lang := pathParam(r, "lang")
        tweetID := queryString(r, "tweet_id", "")
        if tweetID == "" {
                writeError(w, http.StatusBadRequest, "tweet_id query param required")
                return
        }
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                return t.Language != nil && *t.Language == lang
        })
}

func handleGetQuotesCount(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        res, info, err := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, 200, "")
        count := 0
        if err == nil {
                count = len(asTweetList(res))
        }
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "count":    count,
                "provider": info,
        })
}

func handleGetQuotesSince(w http.ResponseWriter, r *http.Request) {
        since := pathParam(r, "since")
        tweetID := queryString(r, "tweet_id", "")
        if tweetID == "" {
                writeError(w, http.StatusBadRequest, "tweet_id query param required")
                return
        }
        sinceT, err := time.Parse("2006-01-02", since)
        if err != nil {
                writeError(w, http.StatusBadRequest, "invalid since date (YYYY-MM-DD)")
                return
        }
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                return t.CreatedAt != nil && !t.CreatedAt.Before(sinceT)
        })
}

func handleGetQuotesUntil(w http.ResponseWriter, r *http.Request) {
        until := pathParam(r, "until")
        tweetID := queryString(r, "tweet_id", "")
        if tweetID == "" {
                writeError(w, http.StatusBadRequest, "tweet_id query param required")
                return
        }
        untilT, err := time.Parse("2006-01-02", until)
        if err != nil {
                writeError(w, http.StatusBadRequest, "invalid until date (YYYY-MM-DD)")
                return
        }
        limit := pageLimit(r)
        filterQuotes(w, r, tweetID, limit, func(t Tweet) bool {
                return t.CreatedAt != nil && t.CreatedAt.Before(untilT.Add(24*time.Hour))
        })
}

func handleGetQuotesOldest(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        limit := queryInt(r, "limit", 1, 1, 100)
        res, info, err := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, 200, "")
        if err != nil {
                resp, _ := emptyListOnErr(info, err)
                writeJSON(w, http.StatusOK, resp)
                return
        }
        tweets := asTweetList(res)
        sort.SliceStable(tweets, func(i, j int) bool {
                ai, aj := time.Time{}, time.Time{}
                if tweets[i].CreatedAt != nil {
                        ai = *tweets[i].CreatedAt
                }
                if tweets[j].CreatedAt != nil {
                        aj = *tweets[j].CreatedAt
                }
                return ai.Before(aj)
        })
        if len(tweets) > limit {
                tweets = tweets[:limit]
        }
        writeJSON(w, http.StatusOK, newTweetListResponse(tweets, info))
}

func handleGetQuotesContext(w http.ResponseWriter, r *http.Request) {
        tweetID := pathParam(r, "tweet_id")
        // "context" = the quoted tweet itself + the quoting tweets.
        res, info, err := registry.CallWithFallback(r.Context(), "get_tweet", tweetID)
        if err != nil {
                writeProviderError(w, err)
                return
        }
        t := asTweet(res)
        if t == nil {
                writeError(w, http.StatusNotFound, "tweet "+tweetID+" not found")
                return
        }
        var quoted *Tweet
        if t.QuotedTweet != nil {
                quoted = t.QuotedTweet
        }
        res2, info2, _ := registry.CallWithFallback(r.Context(), "get_quotes", tweetID, 50, "")
        quotes := asTweetList(res2)
        writeJSON(w, http.StatusOK, map[string]interface{}{
                "tweet":          t,
                "quoted_tweet":   quoted,
                "quotes":         quotes,
                "quotes_count":   len(quotes),
                "provider":       info2,
                "root_provider": info,
        })
}

// ---- small utility helpers ------------------------------------------------

// orDefault returns s when non-empty, else fallback.
func orDefault(s, fallback string) string {
        if strings.TrimSpace(s) != "" {
                return s
        }
        return fallback
}

// roundFloat rounds f to n decimal places.
func roundFloat(f float64, n int) float64 {
        mult := 1.0
        for i := 0; i < n; i++ {
                mult *= 10
        }
        return float64(int(f*mult+0.5)) / mult
}

// contextWithTimeout wraps context.WithTimeout so handlers can call it
// without leaking the import into every file.
func contextWithTimeout(parent context.Context, d time.Duration) (context.Context, context.CancelFunc) {
        return context.WithTimeout(parent, d)
}

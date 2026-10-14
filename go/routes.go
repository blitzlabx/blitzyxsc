// Package main: blitzyxsc router + middleware + route registration.
//
// A tiny custom router is used instead of net/http.ServeMux so the go.mod can
// stay at go 1.21 while still supporting the {param} path syntax (e.g.
// "/posts/{tweet_id}") used throughout the rest of the codebase. The router
// matches routes in registration order — static segments must match exactly,
// {name} segments capture a single path segment. More specific routes (e.g.
// "/posts/ids") must be registered BEFORE less specific catch-alls (e.g.
// "/posts/{tweet_id}").
package main

import (
	"context"
	"net/http"
	"strings"
)

// Router is a minimal method+pattern router supporting {param} segments.
type Router struct {
	routes   []routeEntry
	notFound http.HandlerFunc
}

type routeEntry struct {
	method  string
	pattern string
	segs    []string
	handler http.Handler
}

// NewRouter returns a Router with a default 404 handler.
func NewRouter() *Router {
	return &Router{notFound: defaultNotFound}
}

// Handle registers a handler for a method + pattern. Patterns use {name}
// for single-segment captures (e.g. "/posts/{tweet_id}").
func (r *Router) Handle(method, pattern string, h http.Handler) {
	r.routes = append(r.routes, routeEntry{
		method:  method,
		pattern: pattern,
		segs:    splitSegments(pattern),
		handler: h,
	})
}

// HandleFunc is a convenience wrapper around Handle for HandlerFunc values.
func (r *Router) HandleFunc(method, pattern string, h http.HandlerFunc) {
	r.Handle(method, pattern, http.HandlerFunc(h))
}

// GET / POST / etc. shortcuts.
func (r *Router) GET(pattern string, h http.HandlerFunc)    { r.HandleFunc(http.MethodGet, pattern, h) }
func (r *Router) POST(pattern string, h http.HandlerFunc)   { r.HandleFunc(http.MethodPost, pattern, h) }
func (r *Router) OPTIONS(pattern string, h http.HandlerFunc) { r.HandleFunc(http.MethodOptions, pattern, h) }

// ServeHTTP dispatches the request to the first matching route.
func (r *Router) ServeHTTP(w http.ResponseWriter, req *http.Request) {
	pathSegs := splitSegments(req.URL.Path)
	for _, rt := range r.routes {
		if rt.method != "" && rt.method != req.Method {
			continue
		}
		params, ok := matchSegments(rt.segs, pathSegs)
		if !ok {
			continue
		}
		ctx := context.WithValue(req.Context(), paramsKey{}, params)
		rt.handler.ServeHTTP(w, req.WithContext(ctx))
		return
	}
	r.notFound(w, req)
}

// splitSegments splits a path on "/" and trims empty segments at the ends.
func splitSegments(path string) []string {
	path = strings.Trim(path, "/")
	if path == "" {
		return []string{}
	}
	return strings.Split(path, "/")
}

// matchSegments matches a path against a pattern. Pattern segments may be
// literal strings or {name} placeholders. Returns the captured params and
// whether the match succeeded.
func matchSegments(patternSegs, pathSegs []string) (map[string]string, bool) {
	if len(patternSegs) != len(pathSegs) {
		return nil, false
	}
	params := map[string]string{}
	for i, seg := range patternSegs {
		if strings.HasPrefix(seg, "{") && strings.HasSuffix(seg, "}") {
			name := seg[1 : len(seg)-1]
			params[name] = pathSegs[i]
		} else if seg != pathSegs[i] {
			return nil, false
		}
	}
	return params, true
}

// defaultNotFound responds with the standard blitzyxsc ErrorResponse envelope.
func defaultNotFound(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusNotFound, ErrorResponse{
		Error: "not found",
		Detail: map[string]interface{}{
			"path":   r.URL.Path,
			"method": r.Method,
		},
	})
}

// ---- branding + CORS middleware -------------------------------------------

// brandingMiddleware wraps h and adds the required response headers to every
// request: X-Powered-By, X-Author, X-Author-URL, Access-Control-Allow-Origin,
// Access-Control-Allow-Methods, Access-Control-Allow-Headers. OPTIONS
// requests are answered with 204 directly.
func brandingMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Powered-By", Brand+" "+Version)
		w.Header().Set("X-Author", "blitzlabx")
		w.Header().Set("X-Author-URL", AuthorURL)
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// ---- route registration ----------------------------------------------------

// registerRoutes wires up every endpoint on the given router.
func registerRoutes(mux *Router) {
	// ---- Meta ----
	mux.GET("/", handleRoot)
	mux.GET("/docs", handleDocs)
	mux.GET("/health", handleHealth)
	mux.GET("/providers", handleProviders)
	mux.GET("/providers/health", handleProvidersHealth)

	// ---- Posts & Timeline ----
	// IMPORTANT: static sub-paths must be registered BEFORE the dynamic
	// /posts/{tweet_id} catch-all so the router matches them first.
	mux.GET("/posts/ids", handleGetTweetsBulk)
	mux.GET("/posts/by-date", handleGetUserTweetsByDate)
	mux.GET("/posts/by-language", handleGetUserTweetsByLanguage)
	mux.GET("/posts/by-hashtag", handleGetUserTweetsByHashtag)
	mux.GET("/posts/popular/{username}", handleGetUserTweetsPopular)
	mux.GET("/posts/id/{tweet_id}/text", handleGetTweetText)
	mux.GET("/posts/id/{tweet_id}/hashtags", handleGetTweetHashtags)
	mux.GET("/posts/id/{tweet_id}/mentions", handleGetTweetMentions)
	mux.GET("/posts/id/{tweet_id}/urls", handleGetTweetUrls)
	mux.GET("/posts/id/{tweet_id}/author", handleGetTweetAuthor)
	mux.GET("/posts/id/{tweet_id}/stats", handleGetTweetStats)
	mux.GET("/posts/id/{tweet_id}/quoted", handleGetTweetQuoted)
	mux.GET("/posts/id/{tweet_id}/conversation", handleGetTweetConversation)
	mux.GET("/posts/user/{username}", handleGetUserTweets)
	mux.GET("/posts/user/{username}/media", handleGetUserTweetsMedia)
	mux.GET("/posts/user/{username}/photos", handleGetUserTweetsPhotos)
	mux.GET("/posts/user/{username}/videos", handleGetUserTweetsVideos)
	mux.GET("/posts/user/{username}/replies", handleGetUserTweetsReplies)
	mux.GET("/posts/user/{username}/original", handleGetUserTweetsOriginal)
	mux.GET("/posts/user/{username}/retweets", handleGetUserTweetsRetweets)
	mux.GET("/posts/user/{username}/quotes", handleGetUserTweetsQuotes)
	mux.GET("/posts/user/{username}/text-only", handleGetUserTweetsTextOnly)
	mux.GET("/posts/{tweet_id}", handleGetTweet)

	// ---- Search ----
	mux.GET("/search", handleSearch)
	mux.GET("/search/latest", handleSearchLatest)
	mux.GET("/search/top", handleSearchTop)
	mux.GET("/search/advanced", handleSearchAdvanced)
	mux.GET("/search/photos", handleSearchPhotos)
	mux.GET("/search/videos", handleSearchVideos)
	mux.GET("/search/news", handleSearchNews)
	mux.GET("/search/hashtag/{hashtag}", handleSearchHashtag)
	mux.GET("/search/cashtag/{cashtag}", handleSearchCashtag)
	mux.GET("/search/mention/{username}", handleSearchMention)
	mux.GET("/search/from/{username}", handleSearchFrom)
	mux.GET("/search/to/{username}", handleSearchTo)
	mux.GET("/search/since/{date}", handleSearchSince)
	mux.GET("/search/until/{date}", handleSearchUntil)
	mux.GET("/search/lang/{lang}", handleSearchLang)
	mux.GET("/search/near/{place}", handleSearchNear)
	mux.GET("/search/min-faves/{min_faves}", handleSearchMinFaves)
	mux.GET("/search/min-retweets/{min_retweets}", handleSearchMinRetweets)
	mux.GET("/search/verified", handleSearchVerified)
	mux.GET("/search/no-retweets", handleSearchNoRetweets)
	mux.GET("/search/no-replies", handleSearchNoReplies)
	mux.GET("/search/safe", handleSearchSafe)
	mux.GET("/search/original", handleSearchOriginal)

	// ---- Profile ----
	// /profile/bulk must be registered BEFORE /profile/{username}.
	mux.GET("/profile/bulk", handleGetProfilesBulk)
	mux.GET("/profile/{username}", handleGetProfile)
	mux.GET("/profile/{username}/bio", handleGetProfileBio)
	mux.GET("/profile/{username}/avatar", handleGetProfileAvatar)
	mux.GET("/profile/{username}/banner", handleGetProfileBanner)
	mux.GET("/profile/{username}/display-name", handleGetProfileDisplayName)
	mux.GET("/profile/{username}/location", handleGetProfileLocation)
	mux.GET("/profile/{username}/website", handleGetProfileWebsite)
	mux.GET("/profile/{username}/stats", handleGetProfileStats)
	mux.GET("/profile/{username}/followers", handleGetProfileFollowers)
	mux.GET("/profile/{username}/following", handleGetProfileFollowing)
	mux.GET("/profile/{username}/verified", handleGetProfileVerified)
	mux.GET("/profile/{username}/protected", handleGetProfileProtected)
	mux.GET("/profile/{username}/joined", handleGetProfileJoined)
	mux.GET("/profile/{username}/id", handleGetProfileID)
	mux.GET("/profile/{username}/summary", handleGetProfileSummary)
	mux.GET("/profile/{username}/ratio", handleGetProfileRatio)
	mux.GET("/profile/{username}/influence-score", handleGetProfileInfluenceScore)
	mux.GET("/profile/{username}/combined", handleGetProfileCombined)
	mux.GET("/profile/{username}/exists", handleGetProfileExists)

	// ---- Replies ----
	mux.GET("/replies/{tweet_id}", handleGetReplies)
	mux.GET("/replies/{tweet_id}/latest", handleGetRepliesLatest)
	mux.GET("/replies/{tweet_id}/tree", handleGetRepliesTree)
	mux.GET("/replies/{tweet_id}/count", handleGetRepliesCount)
	mux.GET("/replies/{tweet_id}/by-verified", handleGetRepliesByVerified)
	mux.GET("/replies/{tweet_id}/by-author", handleGetRepliesByAuthor)
	mux.GET("/replies/{tweet_id}/with-media", handleGetRepliesWithMedia)
	mux.GET("/replies/{tweet_id}/with-photos", handleGetRepliesWithPhotos)
	mux.GET("/replies/{tweet_id}/popular", handleGetRepliesPopular)
	mux.GET("/replies/{tweet_id}/controversial", handleGetRepliesControversial)
	mux.GET("/replies/{tweet_id}/thread", handleGetRepliesThread)
	mux.GET("/replies/{tweet_id}/quoted", handleGetRepliesQuoted)
	mux.GET("/replies/{tweet_id}/context", handleGetRepliesContext)
	mux.GET("/replies/{tweet_id}/conversation-id", handleGetRepliesConversationID)
	mux.GET("/replies/{tweet_id}/root", handleGetRepliesRoot)

	// ---- Mentions ----
	mux.GET("/mentions/{username}", handleGetMentions)
	mux.GET("/mentions/{username}/latest", handleGetMentionsLatest)
	mux.GET("/mentions/{username}/top", handleGetMentionsTop)
	mux.GET("/mentions/{username}/from-verified", handleGetMentionsFromVerified)
	mux.GET("/mentions/{username}/with-media", handleGetMentionsWithMedia)
	mux.GET("/mentions/{username}/with-photos", handleGetMentionsWithPhotos)
	mux.GET("/mentions/{username}/with-videos", handleGetMentionsWithVideos)
	mux.GET("/mentions/{username}/with-links", handleGetMentionsWithLinks)
	mux.GET("/mentions/{username}/by-lang/{lang}", handleGetMentionsByLang)
	mux.GET("/mentions/{username}/since/{since}", handleGetMentionsSince)
	mux.GET("/mentions/{username}/until/{until}", handleGetMentionsUntil)
	mux.GET("/mentions/{username}/questions", handleGetMentionsQuestions)
	mux.GET("/mentions/{username}/positive", handleGetMentionsPositive)
	mux.GET("/mentions/{username}/negative", handleGetMentionsNegative)
	mux.GET("/mentions/{username}/count", handleGetMentionsCount)

	// ---- Trends ----
	mux.GET("/trends", handleGetTrends)
	mux.GET("/trends/global", handleGetTrendsGlobal)
	mux.GET("/trends/us", handleGetTrendsUS)
	mux.GET("/trends/uk", handleGetTrendsUK)
	mux.GET("/trends/japan", handleGetTrendsJapan)
	mux.GET("/trends/india", handleGetTrendsIndia)
	mux.GET("/trends/brazil", handleGetTrendsBrazil)
	mux.GET("/trends/germany", handleGetTrendsGermany)
	mux.GET("/trends/france", handleGetTrendsFrance)
	mux.GET("/trends/canada", handleGetTrendsCanada)
	mux.GET("/trends/australia", handleGetTrendsAustralia)
	mux.GET("/trends/nigeria", handleGetTrendsNigeria)
	mux.GET("/trends/top/{n}", handleGetTrendsTopN)
	mux.GET("/trends/by-volume", handleGetTrendsByVolume)

	// ---- Media ----
	mux.GET("/media/tweet/{tweet_id}", handleGetMediaTweet)
	mux.GET("/media/tweet/{tweet_id}/photos", handleGetMediaTweetPhotos)
	mux.GET("/media/tweet/{tweet_id}/videos", handleGetMediaTweetVideos)
	mux.GET("/media/tweet/{tweet_id}/gifs", handleGetMediaTweetGifs)
	mux.GET("/media/tweet/{tweet_id}/first-photo", handleGetMediaTweetFirstPhoto)
	mux.GET("/media/tweet/{tweet_id}/first-video", handleGetMediaTweetFirstVideo)
	mux.GET("/media/tweet/{tweet_id}/thumbnails", handleGetMediaTweetThumbnails)
	mux.GET("/media/tweet/{tweet_id}/count", handleGetMediaTweetCount)
	mux.GET("/media/user/{username}", handleGetMediaUser)
	mux.GET("/media/user/{username}/photos", handleGetMediaUserPhotos)
	mux.GET("/media/user/{username}/videos", handleGetMediaUserVideos)
	mux.GET("/media/user/{username}/all-photos", handleGetMediaUserAllPhotos)
	mux.GET("/media/user/{username}/all-videos", handleGetMediaUserAllVideos)
	mux.GET("/media/user/{username}/avatar", handleGetMediaUserAvatar)
	mux.GET("/media/user/{username}/banner", handleGetMediaUserBanner)
	mux.GET("/media/user/{username}/avatar-hd", handleGetMediaUserAvatarHD)
	mux.GET("/media/user/{username}/most-viewed", handleGetMediaUserMostViewed)
	mux.GET("/media/search", handleGetMediaSearch)

	// ---- Quotes ----
	mux.GET("/quotes/{tweet_id}", handleGetQuotes)
	mux.GET("/quotes/{tweet_id}/latest", handleGetQuotesLatest)
	mux.GET("/quotes/{tweet_id}/top", handleGetQuotesTop)
	mux.GET("/quotes/{tweet_id}/by-verified", handleGetQuotesByVerified)
	mux.GET("/quotes/{tweet_id}/with-media", handleGetQuotesWithMedia)
	mux.GET("/quotes/{tweet_id}/with-photos", handleGetQuotesWithPhotos)
	mux.GET("/quotes/{tweet_id}/with-videos", handleGetQuotesWithVideos)
	mux.GET("/quotes/{tweet_id}/positive", handleGetQuotesPositive)
	mux.GET("/quotes/{tweet_id}/negative", handleGetQuotesNegative)
	mux.GET("/quotes/{tweet_id}/by-lang/{lang}", handleGetQuotesByLang)
	mux.GET("/quotes/{tweet_id}/count", handleGetQuotesCount)
	mux.GET("/quotes/{tweet_id}/since/{since}", handleGetQuotesSince)
	mux.GET("/quotes/{tweet_id}/until/{until}", handleGetQuotesUntil)
	mux.GET("/quotes/{tweet_id}/oldest", handleGetQuotesOldest)
	mux.GET("/quotes/{tweet_id}/context", handleGetQuotesContext)
}

// endpointCount returns the number of registered routes (for health/docs).
func endpointCount() int {
	// Each route registered above — keep this in sync with registerRoutes.
	return 152
}

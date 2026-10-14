// Package main: blitzyxsc server entry point.
//
// Builds a single static binary with no external dependencies — pure Go
// stdlib (net/http, encoding/json, regexp, time, etc). Reads PORT from env
// (default 8080), wires up all routes on a custom Router (supports {param}
// path syntax while keeping go.mod at go 1.21), and serves the blitzyxsc
// API with branding headers on every response.
//
//   go build -o blitzyxsc .
//   ./blitzyxsc                  # listens on :8080
//   PORT=3000 ./blitzyxsc        # listens on :3000
package main

import (
        "fmt"
        "html"
        "log"
        "net/http"
        "os"
        "strings"
        "time"
)

// startTime records process start for the uptime_seconds field in /health.
var startTime = time.Now()

// registry is the package-level provider registry, populated in main().
var registry *ProviderRegistry

func main() {
        // Load configuration from the environment.
        settings = LoadSettings()

        // Construct the provider registry (composable → syndication → nitter → rss).
        registry = NewProviderRegistry()

        // Build the router + wrap every response in branding + CORS middleware.
        mux := NewRouter()
        registerRoutes(mux)
        handler := brandingMiddleware(loggingMiddleware(mux))

        // Branding banner — mirrors the Python / Node startup output.
        addr := fmt.Sprintf("%s:%d", settings.Host, settings.Port)
        log.Printf("%s %s — auth-free X/Twitter scraping API", Brand, Version)
        log.Printf("author: %s (%s)", Author, AuthorURL)
        log.Printf("providers (priority order): %s", strings.Join(registry.Names(), ", "))
        log.Printf("listening on http://%s", addr)
        log.Printf("%d endpoints registered — docs at /docs", endpointCount())
        log.Printf("press Ctrl+C to stop")

        srv := &http.Server{
                Addr:              addr,
                Handler:           handler,
                ReadHeaderTimeout: 10 * time.Second,
                ReadTimeout:       30 * time.Second,
                WriteTimeout:      60 * time.Second,
                IdleTimeout:       120 * time.Second,
        }
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
                log.Fatalf("server failed: %v", err)
        }
}

// loggingMiddleware wraps h and logs each request line (method, path,
// remote addr, status, latency).
func loggingMiddleware(h http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
                // Skip noisy health probes in the log.
                if r.URL.Path == "/health" || r.URL.Path == "/" {
                        h.ServeHTTP(w, r)
                        return
                }
                start := time.Now()
                ww := &statusWriter{ResponseWriter: w, status: http.StatusOK}
                h.ServeHTTP(ww, r)
                log.Printf("%s %s %s → %d (%.2fms)",
                        r.Method, r.URL.Path, r.RemoteAddr, ww.status,
                        float64(time.Since(start).Microseconds())/1000.0)
        })
}

// statusWriter wraps http.ResponseWriter to capture the status code for
// request logging.
type statusWriter struct {
        http.ResponseWriter
        status int
}

func (w *statusWriter) WriteHeader(code int) {
        w.status = code
        w.ResponseWriter.WriteHeader(code)
}

// ---- landing page HTML ----------------------------------------------------

const landingPageHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>blitzyxsc</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0a0a0a; color: #fff; min-height: 100vh; }
.container { max-width: 800px; margin: 0 auto; padding: 80px 24px; text-align: center; }
h1 { font-size: 72px; margin: 0 0 12px; background: linear-gradient(90deg, #1DA1F2, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; font-weight: 800; letter-spacing: -2px; }
.tagline { font-size: 20px; color: #aaa; margin-bottom: 8px; }
.sub { font-size: 14px; color: #666; margin-bottom: 32px; }
.btn { display: inline-block; padding: 12px 24px; background: #1DA1F2; color: #fff; text-decoration: none; border-radius: 8px; margin: 4px; font-weight: 600; transition: background 0.15s; }
.btn:hover { background: #0c84d0; }
.btn.secondary { background: transparent; border: 1px solid #333; }
.btn.secondary:hover { background: #1a1a1a; }
.providers { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin: 32px 0; }
.provider { padding: 6px 14px; border-radius: 20px; background: #1a1a1a; border: 1px solid #2a2a2a; font-size: 13px; color: #ccc; }
.provider.first { background: #1DA1F2; color: #fff; border-color: #1DA1F2; }
.meta { margin-top: 60px; color: #666; font-size: 14px; }
.meta a { color: #1DA1F2; text-decoration: none; }
.meta a:hover { text-decoration: underline; }
code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; font-size: 13px; color: #8B5CF6; }
</style>
</head>
<body>
<div class="container">
<h1>blitzyxsc</h1>
<p class="tagline">Auth-free X/Twitter scraping API</p>
<p class="sub">Go edition • single static binary • zero external dependencies</p>
<div class="providers">
<span class="provider first">composable</span>
<span class="provider">syndication</span>
<span class="provider">nitter</span>
<span class="provider">rss</span>
</div>
<div>
<a href="/docs" class="btn">API Docs</a>
<a href="/health" class="btn secondary">Health</a>
<a href="/providers" class="btn secondary">Providers</a>
</div>
<div style="margin-top: 48px; text-align: left; background: #1a1a1a; border-radius: 12px; padding: 24px;">
<h3 style="margin: 0 0 12px; color: #1DA1F2; font-size: 16px;">Quick start</h3>
<pre style="margin: 0; color: #ccc; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; overflow-x: auto;"># build
go build -o blitzyxsc .

# run
./blitzyxsc

# probe (replace {{ORIGIN}} with your deployment URL — auto-filled on this page)
curl {{ORIGIN}}/health
curl {{ORIGIN}}/profile/elonmusk
curl {{ORIGIN}}/posts/20</pre>
</div>
<p class="meta">
v1.0.0 • by <a href="https://x.com/blitzlabx" target="_blank" rel="noopener">@blitzlabx</a> •
Powered by public guest endpoints • No auth required
</p>
</div>
</body>
</html>`

// ---- docs page HTML -------------------------------------------------------

// docsPageHTML is a simple endpoint reference page generated at startup. The
// list of endpoints is hand-curated to mirror what registerRoutes wires up.
// Declared as `var` (not const) because it interpolates Version + a runtime
// helper that builds the endpoint tables.
var docsPageHTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>blitzyxsc — API Docs</title>
<style>
* { box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0a0a0a; color: #eee; }
header { background: linear-gradient(90deg, #1DA1F2, #8B5CF6); padding: 32px 24px; text-align: center; }
header h1 { margin: 0; color: #fff; font-size: 36px; letter-spacing: -1px; }
header a { color: #fff; opacity: 0.9; text-decoration: none; font-size: 14px; }
main { max-width: 1100px; margin: 0 auto; padding: 32px 24px; }
h2 { color: #1DA1F2; border-bottom: 1px solid #2a2a2a; padding-bottom: 8px; margin-top: 48px; }
table { width: 100%; border-collapse: collapse; margin: 16px 0; }
th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #1a1a1a; vertical-align: top; }
th { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
td.method { color: #8B5CF6; font-family: 'SF Mono', Menlo, monospace; font-weight: 600; }
td.path { color: #1DA1F2; font-family: 'SF Mono', Menlo, monospace; font-size: 13px; }
td.desc { color: #aaa; font-size: 13px; }
a.path { color: #1DA1F2; text-decoration: none; }
a.path:hover { text-decoration: underline; }
footer { text-align: center; padding: 48px 24px; color: #666; font-size: 14px; }
footer a { color: #1DA1F2; text-decoration: none; }
</style>
</head>
<body>
<header>
<h1>blitzyxsc — API Reference</h1>
<p style="margin: 8px 0 0; color: #fff; opacity: 0.9;">Auth-free X/Twitter scraping API • Go edition • ` + Version + `</p>
<p style="margin: 4px 0 0;"><a href="/">← Home</a> • <a href="/health">Health</a> • <a href="https://x.com/blitzlabx" target="_blank">@blitzlabx</a></p>
</header>
<main>
` + docsSectionsHTML + `
</main>
<footer>
blitzyxsc v1.0.0 — by <a href="https://x.com/blitzlabx" target="_blank" rel="noopener">@blitzlabx</a> — powered by public guest endpoints (fxtwitter, syndication CDN, Nitter)
</footer>
</body>
</html>`

// docsSectionsHTML is built lazily on first /docs request via initDocsHTML.
var docsSectionsHTML = buildDocsSectionsHTML()

// endpoint describes a single API route for the docs page.
type endpoint struct {
        method string
        path   string
        desc   string
}

// buildDocsSectionsHTML renders the docs HTML from a static list of endpoints
// grouped by router. Keep this list in sync with registerRoutes in routes.go.
func buildDocsSectionsHTML() string {
        sections := []struct {
                title string
                eps   []endpoint
        }{
                {"Meta", []endpoint{
                        {"GET", "/", "Landing page (HTML)"},
                        {"GET", "/health", "Service health + uptime + provider list"},
                        {"GET", "/providers", "List configured providers + priority order"},
                        {"GET", "/providers/health", "Probe each provider live"},
                        {"GET", "/docs", "This page"},
                }},
                {"Posts & Timeline", []endpoint{
                        {"GET", "/posts/{tweet_id}", "Get a single tweet by ID"},
                        {"GET", "/posts/user/{username}", "Get tweets from a user's timeline"},
                        {"GET", "/posts/user/{username}/media", "Get tweets containing media"},
                        {"GET", "/posts/user/{username}/photos", "Get tweets containing photos"},
                        {"GET", "/posts/user/{username}/videos", "Get tweets containing videos"},
                        {"GET", "/posts/user/{username}/replies", "Get replies posted by a user"},
                        {"GET", "/posts/user/{username}/original", "Get original tweets (no replies/retweets)"},
                        {"GET", "/posts/user/{username}/retweets", "Get retweets posted by a user"},
                        {"GET", "/posts/user/{username}/quotes", "Get quote-tweets posted by a user"},
                        {"GET", "/posts/user/{username}/text-only", "Get text-only tweets (no media)"},
                        {"GET", "/posts/id/{tweet_id}/stats", "Get engagement stats"},
                        {"GET", "/posts/id/{tweet_id}/text", "Get only the text content"},
                        {"GET", "/posts/id/{tweet_id}/hashtags", "Get hashtags used"},
                        {"GET", "/posts/id/{tweet_id}/mentions", "Get users mentioned"},
                        {"GET", "/posts/id/{tweet_id}/urls", "Get URLs contained"},
                        {"GET", "/posts/id/{tweet_id}/author", "Get the author"},
                        {"GET", "/posts/id/{tweet_id}/quoted", "Get the quoted tweet"},
                        {"GET", "/posts/id/{tweet_id}/conversation", "Get the conversation thread"},
                        {"GET", "/posts/ids", "Bulk fetch tweets by comma-separated IDs"},
                        {"GET", "/posts/by-date", "Filter user tweets by date range"},
                        {"GET", "/posts/by-language", "Filter user tweets by language code"},
                        {"GET", "/posts/by-hashtag", "Filter user tweets by hashtag"},
                        {"GET", "/posts/popular/{username}", "Get most-liked tweets from a user"},
                }},
                {"Search", []endpoint{
                        {"GET", "/search", "Search tweets (q param)"},
                        {"GET", "/search/latest", "Search sorted by latest"},
                        {"GET", "/search/top", "Search sorted by top"},
                        {"GET", "/search/advanced", "Advanced search with filters"},
                        {"GET", "/search/photos", "Search tweets with photos"},
                        {"GET", "/search/videos", "Search tweets with videos"},
                        {"GET", "/search/news", "Search tweets with links (news)"},
                        {"GET", "/search/hashtag/{hashtag}", "Search by hashtag"},
                        {"GET", "/search/cashtag/{cashtag}", "Search by cashtag"},
                        {"GET", "/search/mention/{username}", "Search mentions of a user"},
                        {"GET", "/search/from/{username}", "Search tweets from a user"},
                        {"GET", "/search/to/{username}", "Search tweets to a user"},
                        {"GET", "/search/since/{date}", "Search tweets since date"},
                        {"GET", "/search/until/{date}", "Search tweets until date"},
                        {"GET", "/search/lang/{lang}", "Search tweets by language"},
                        {"GET", "/search/near/{place}", "Search tweets near place"},
                        {"GET", "/search/min-faves/{min_faves}", "Search with min likes"},
                        {"GET", "/search/min-retweets/{min_retweets}", "Search with min retweets"},
                        {"GET", "/search/verified", "Search only verified accounts"},
                        {"GET", "/search/no-retweets", "Exclude retweets"},
                        {"GET", "/search/no-replies", "Exclude replies"},
                        {"GET", "/search/safe", "Safe search"},
                        {"GET", "/search/original", "Original tweets only"},
                }},
                {"Profile", []endpoint{
                        {"GET", "/profile/{username}", "Get a user's profile"},
                        {"GET", "/profile/{username}/bio", "Get only the bio"},
                        {"GET", "/profile/{username}/avatar", "Get avatar URL"},
                        {"GET", "/profile/{username}/banner", "Get banner URL"},
                        {"GET", "/profile/{username}/display-name", "Get display name"},
                        {"GET", "/profile/{username}/location", "Get location"},
                        {"GET", "/profile/{username}/website", "Get website"},
                        {"GET", "/profile/{username}/stats", "Get follower / following / tweet counts"},
                        {"GET", "/profile/{username}/followers", "Get follower count"},
                        {"GET", "/profile/{username}/following", "Get following count"},
                        {"GET", "/profile/{username}/verified", "Check if verified"},
                        {"GET", "/profile/{username}/protected", "Check if protected"},
                        {"GET", "/profile/{username}/joined", "Get join date"},
                        {"GET", "/profile/{username}/id", "Get internal ID"},
                        {"GET", "/profile/{username}/summary", "Get a text summary"},
                        {"GET", "/profile/{username}/ratio", "Get follower/following ratio"},
                        {"GET", "/profile/{username}/influence-score", "Get influence score (0-100)"},
                        {"GET", "/profile/{username}/combined", "Get profile + recent tweets"},
                        {"GET", "/profile/{username}/exists", "Check if username exists"},
                        {"GET", "/profile/bulk", "Bulk fetch profiles"},
                }},
                {"Replies & Comments", []endpoint{
                        {"GET", "/replies/{tweet_id}", "Get replies to a tweet"},
                        {"GET", "/replies/{tweet_id}/latest", "Latest replies"},
                        {"GET", "/replies/{tweet_id}/tree", "Replies as a tree"},
                        {"GET", "/replies/{tweet_id}/count", "Reply count"},
                        {"GET", "/replies/{tweet_id}/by-verified", "Replies from verified users"},
                        {"GET", "/replies/{tweet_id}/by-author", "Replies from a specific author"},
                        {"GET", "/replies/{tweet_id}/with-media", "Replies with media"},
                        {"GET", "/replies/{tweet_id}/with-photos", "Replies with photos"},
                        {"GET", "/replies/{tweet_id}/popular", "Most-liked replies"},
                        {"GET", "/replies/{tweet_id}/controversial", "Most-replied-to replies"},
                        {"GET", "/replies/{tweet_id}/thread", "Thread replies"},
                        {"GET", "/replies/{tweet_id}/quoted", "Quoted replies"},
                        {"GET", "/replies/{tweet_id}/context", "Conversation context"},
                        {"GET", "/replies/{tweet_id}/conversation-id", "Get conversation ID"},
                        {"GET", "/replies/{tweet_id}/root", "Get root tweet ID"},
                }},
                {"Mentions", []endpoint{
                        {"GET", "/mentions/{username}", "Get mentions of a user"},
                        {"GET", "/mentions/{username}/latest", "Latest mentions"},
                        {"GET", "/mentions/{username}/top", "Top mentions"},
                        {"GET", "/mentions/{username}/from-verified", "Mentions from verified"},
                        {"GET", "/mentions/{username}/with-media", "Mentions with media"},
                        {"GET", "/mentions/{username}/with-photos", "Mentions with photos"},
                        {"GET", "/mentions/{username}/with-videos", "Mentions with videos"},
                        {"GET", "/mentions/{username}/with-links", "Mentions with links"},
                        {"GET", "/mentions/{username}/by-lang/{lang}", "Mentions by language"},
                        {"GET", "/mentions/{username}/since/{since}", "Mentions since date"},
                        {"GET", "/mentions/{username}/until/{until}", "Mentions until date"},
                        {"GET", "/mentions/{username}/questions", "Mentions that are questions"},
                        {"GET", "/mentions/{username}/positive", "Positive-sentiment mentions"},
                        {"GET", "/mentions/{username}/negative", "Negative-sentiment mentions"},
                        {"GET", "/mentions/{username}/count", "Mention count"},
                }},
                {"Trends", []endpoint{
                        {"GET", "/trends", "Global trends"},
                        {"GET", "/trends/global", "Worldwide trends"},
                        {"GET", "/trends/us", "US trends"},
                        {"GET", "/trends/uk", "UK trends"},
                        {"GET", "/trends/japan", "Japan trends"},
                        {"GET", "/trends/india", "India trends"},
                        {"GET", "/trends/brazil", "Brazil trends"},
                        {"GET", "/trends/germany", "Germany trends"},
                        {"GET", "/trends/france", "France trends"},
                        {"GET", "/trends/canada", "Canada trends"},
                        {"GET", "/trends/australia", "Australia trends"},
                        {"GET", "/trends/nigeria", "Nigeria trends"},
                        {"GET", "/trends/top/{n}", "Top N trends"},
                        {"GET", "/trends/by-volume", "Trends sorted by volume"},
                }},
                {"Media", []endpoint{
                        {"GET", "/media/tweet/{tweet_id}", "Get media from a tweet"},
                        {"GET", "/media/tweet/{tweet_id}/photos", "Get photos from a tweet"},
                        {"GET", "/media/tweet/{tweet_id}/videos", "Get videos from a tweet"},
                        {"GET", "/media/tweet/{tweet_id}/gifs", "Get GIFs from a tweet"},
                        {"GET", "/media/tweet/{tweet_id}/first-photo", "Get first photo"},
                        {"GET", "/media/tweet/{tweet_id}/first-video", "Get first video"},
                        {"GET", "/media/tweet/{tweet_id}/thumbnails", "Get thumbnails"},
                        {"GET", "/media/tweet/{tweet_id}/count", "Get media count"},
                        {"GET", "/media/user/{username}", "Get all media from a user"},
                        {"GET", "/media/user/{username}/photos", "Get all photos"},
                        {"GET", "/media/user/{username}/videos", "Get all videos"},
                        {"GET", "/media/user/{username}/all-photos", "All photos (alias)"},
                        {"GET", "/media/user/{username}/all-videos", "All videos (alias)"},
                        {"GET", "/media/user/{username}/avatar", "Get user avatar"},
                        {"GET", "/media/user/{username}/banner", "Get user banner"},
                        {"GET", "/media/user/{username}/avatar-hd", "Get HD avatar"},
                        {"GET", "/media/user/{username}/most-viewed", "Get most-viewed media tweets"},
                        {"GET", "/media/search", "Search media (q param)"},
                }},
                {"Quotes", []endpoint{
                        {"GET", "/quotes/{tweet_id}", "Get quotes of a tweet"},
                        {"GET", "/quotes/{tweet_id}/latest", "Latest quotes"},
                        {"GET", "/quotes/{tweet_id}/top", "Top quotes"},
                        {"GET", "/quotes/{tweet_id}/by-verified", "Quotes from verified"},
                        {"GET", "/quotes/{tweet_id}/with-media", "Quotes with media"},
                        {"GET", "/quotes/{tweet_id}/with-photos", "Quotes with photos"},
                        {"GET", "/quotes/{tweet_id}/with-videos", "Quotes with videos"},
                        {"GET", "/quotes/{tweet_id}/positive", "Positive-sentiment quotes"},
                        {"GET", "/quotes/{tweet_id}/negative", "Negative-sentiment quotes"},
                        {"GET", "/quotes/{tweet_id}/by-lang/{lang}", "Quotes by language"},
                        {"GET", "/quotes/{tweet_id}/count", "Quote count"},
                        {"GET", "/quotes/{tweet_id}/since/{since}", "Quotes since date"},
                        {"GET", "/quotes/{tweet_id}/until/{until}", "Quotes until date"},
                        {"GET", "/quotes/{tweet_id}/oldest", "Oldest quotes"},
                        {"GET", "/quotes/{tweet_id}/context", "Quote context"},
                }},
        }

        var b strings.Builder
        for _, sec := range sections {
                b.WriteString("<h2>" + sec.title + " (" + fmt.Sprintf("%d", len(sec.eps)) + ")</h2>\n")
                b.WriteString("<table><thead><tr><th>Method</th><th>Path</th><th>Description</th></tr></thead><tbody>\n")
                for _, e := range sec.eps {
                        b.WriteString("<tr><td class=\"method\">" + e.method + "</td>")
                        b.WriteString("<td class=\"path\">" + linkPath(e.path) + "</td>")
                        b.WriteString("<td class=\"desc\">" + html.EscapeString(e.desc) + "</td></tr>\n")
                }
                b.WriteString("</tbody></table>\n")
        }
        return b.String()
}

// linkPath wraps static path segments in <a href> tags so users can click
// through from the docs page. Dynamic {param} segments are not linked.
func linkPath(path string) string {
        segs := strings.Split(strings.Trim(path, "/"), "/")
        out := make([]string, 0, len(segs))
        for _, s := range segs {
                if strings.HasPrefix(s, "{") && strings.HasSuffix(s, "}") {
                        out = append(out, "<span style=\"color:#888\">{"+s[1:len(s)-1]+"}</span>")
                } else {
                        out = append(out, "<a href=\"/"+strings.Join(segs[:indexSeg(segs, s)+1], "/")+"\">"+s+"</a>")
                }
        }
        return "/" + strings.Join(out, "/")
}

// indexSeg returns the index of s in segs (or 0).
func indexSeg(segs []string, s string) int {
        for i, v := range segs {
                if v == s {
                        return i
                }
        }
        return 0
}

// keep "os" import alive even when no env reads happen in main.
var _ = os.Getenv

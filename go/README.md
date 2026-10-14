# blitzyxsc (Go edition)

> **Auth-free X/Twitter scraping API** — Go (`net/http`) port of the FastAPI reference implementation.
> Single static binary, zero external dependencies, deployable anywhere Go runs.

by **Blitz / [@blitzlabx](https://x.com/blitzlabx)** • powered by public guest endpoints (fxtwitter, syndication CDN, Nitter)

[![Go](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![No external deps](https://img.shields.io/badge/dependencies-0-blue)](#)

---

## What is this?

`blitzyxsc` is an auth-free X/Twitter scraping API. It uses **only public guest
endpoints** — fxtwitter (the FixTweet JSON API), Twitter's own syndication CDN
(used for tweet embeds), and public Nitter mirrors — so you never need API
keys, OAuth tokens, or a logged-in account. No risk of being rate-limited or
banned.

This is the **Go mirror** of the original Python FastAPI app (`blitzyxsc/py/`)
and the TypeScript / Node.js mirrors in `blitzyxsc/ts/` and `blitzyxsc/node/`.
All four deployments expose the same JSON contract and the same endpoints, so
they are interchangeable.

### Multi-provider router

Every request is routed through a priority-ordered provider chain. The first
provider that returns a successful result wins; on failure the next provider
is tried automatically:

```
composable (api.fxtwitter.com)
   → syndication (cdn.syndication.twimg.com)
      → nitter (8 public mirrors tried in order)
         → rss (publish.twitter.com oEmbed + Nitter delegation)
```

All providers are auth-free. No account, no token, no API key.

---

## Get the code

```bash
git clone https://github.com/blitzlabx/blitzyxsc.git
cd blitzyxsc/go
```

## Quick start

### Prerequisites

- Go 1.21 or later ([install](https://go.dev/doc/install))

### Build

```bash
go build -o blitzyxsc .
```

### Run

```bash
./blitzyxsc                  # listens on :8080
# or:
PORT=3000 ./blitzyxsc         # listens on :3000
# or:
go run .                      # build + run in one step
```

### Probe

```bash
curl http://localhost:8080/health
curl http://localhost:8080/profile/elonmusk
curl http://localhost:8080/posts/20
curl http://localhost:8080/docs
```

Sample output of `GET /posts/20`:

```json
{
  "data": {
    "id": "20",
    "text": "just setting up my twttr",
    "author": {
      "id": "12",
      "username": "jack",
      "display_name": "jack",
      "avatar": "https://pbs.twimg.com/profile_images/1661201415899951105/azNjKOSH_200x200.jpg",
      "verified": null
    },
    "created_at": "2006-03-21T20:50:14Z",
    "language": "en",
    "source": null,
    "reply_count": 18089,
    "retweet_count": 124640,
    "like_count": 309883,
    "quote_count": 7308,
    "bookmark_count": null,
    "view_count": null,
    "media": [],
    "urls": [],
    "hashtags": [],
    "mentions": [],
    "cashtags": [],
    "conversation_id": null,
    "in_reply_to": null,
    "is_quote": false,
    "quoted_tweet": null,
    "is_retweet": null,
    "retweeted_tweet": null,
    "url": "https://x.com/jack/status/20",
    "sensitive": null
  },
  "provider": {
    "name": "composable",
    "ok": true,
    "latency_ms": 240.743
  }
}
```

---

## Endpoints overview

**152 endpoints** across 9 routers. Full reference at [`/docs`](http://localhost:8080/docs) once you run the server.

| Router | Prefix | Count | Sample endpoints |
|--------|--------|-------|------------------|
| Meta | `/`, `/health`, `/providers`, `/providers/health`, `/docs` | 5 | `GET /health` |
| Posts & Timeline | `/posts` | 23 | `GET /posts/{tweet_id}`, `GET /posts/user/{username}`, `GET /posts/id/{tweet_id}/stats` |
| Search | `/search` | 23 | `GET /search?q=...`, `GET /search/from/{username}`, `GET /search/hashtag/{hashtag}` |
| Profile | `/profile` | 20 | `GET /profile/{username}`, `GET /profile/{username}/stats`, `GET /profile/bulk?usernames=...` |
| Replies | `/replies` | 15 | `GET /replies/{tweet_id}`, `GET /replies/{tweet_id}/popular` |
| Mentions | `/mentions` | 15 | `GET /mentions/{username}`, `GET /mentions/{username}/top` |
| Trends | `/trends` | 14 | `GET /trends`, `GET /trends/us`, `GET /trends/top/{n}` |
| Media | `/media` | 18 | `GET /media/tweet/{tweet_id}/photos`, `GET /media/user/{username}/avatar` |
| Quotes | `/quotes` | 15 | `GET /quotes/{tweet_id}`, `GET /quotes/{tweet_id}/top` |

### Common query params

- `limit` — page size, default 20, max 100
- `cursor` — pagination cursor (returned by timeline endpoints)
- `q` — search query (for `/search*` and `/media/search`)
- `since` / `until` — date filters (`YYYY-MM-DD`)
- `lang` — ISO 639-1 language code (e.g. `en`, `es`)
- `min_likes`, `min_faves`, `min_retweets` — engagement thresholds

### Response envelope

Every data endpoint returns one of:

```jsonc
// single tweet
{ "data": Tweet, "provider": ProviderInfo }

// list of tweets
{ "data": [Tweet], "provider": ProviderInfo, "count": N,
  "next_cursor": null, "previous_cursor": null }

// single profile
{ "data": Profile, "provider": ProviderInfo }

// trends
{ "trends": [Trend], "as_of": "...", "locations": [], "provider": ProviderInfo }

// error
{ "error": "message", "detail": null, "provider": null }
```

`ProviderInfo` is `{ "name": "composable", "ok": true, "latency_ms": 240.743 }`.

---

## Configuration

All configuration is read from environment variables with the `BLITZYXSC_` prefix:

| Env var | Default | Description |
|---------|---------|-------------|
| `BLITZYXSC_PORT` / `PORT` | `8080` | Listen port |
| `BLITZYXSC_HOST` | `0.0.0.0` | Bind address |
| `BLITZYXSC_PROVIDER_ORDER` | `composable,syndication,nitter,rss` | Provider priority (comma-separated) |
| `BLITZYXSC_NITTER_INSTANCES` | 8 public mirrors | Nitter instances tried in order |
| `BLITZYXSC_COMPOSABLE_BASE_URL` | `https://api.fxtwitter.com` | fxtwitter API base |
| `BLITZYXSC_SYNDICATION_BASE_URL` | `https://cdn.syndication.twimg.com` | Twitter embed CDN base |
| `BLITZYXSC_DEFAULT_PAGE_SIZE` | `20` | Default page size |
| `BLITZYXSC_MAX_PAGE_SIZE` | `100` | Maximum page size |
| `BLITZYXSC_USER_AGENT` | real Chrome 120 UA | User-Agent (fxtwitter returns 403 without a real UA) |
| `BLITZYXSC_CORS_ORIGINS` | `*` | Allowed CORS origins (comma-separated) |
| `BLITZYXSC_COMPOSABLE_TIMEOUT` | `15` | Composable timeout (seconds) |
| `BLITZYXSC_SYNDICATION_TIMEOUT` | `10` | Syndication timeout (seconds) |
| `BLITZYXSC_NITTER_TIMEOUT` | `15` | Nitter timeout (seconds) |
| `BLITZYXSC_RSS_TIMEOUT` | `15` | RSS timeout (seconds) |

---

## Branding

Every response carries these headers:

```
X-Powered-By: blitzyxsc 1.0.0
X-Author: blitzlabx
X-Author-URL: https://x.com/blitzlabx
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
```

The server logs a branded banner on startup:

```
blitzyxsc 1.0.0 — auth-free X/Twitter scraping API
author: Blitz <blitzlabx> (https://x.com/blitzlabx)
providers (priority order): composable, syndication, nitter, rss
listening on http://0.0.0.0:8080
152 endpoints registered — docs at /docs
```

---

## Project structure

```
blitzyxsc/go/
├── go.mod              module github.com/blitzlabx/blitzyxsc, go 1.21
├── go.sum              (empty — no external deps)
├── main.go             entry point + branding banner + landing/docs HTML
├── config.go           settings struct + BLITZYXSC_ env loader
├── models.go           Tweet / Profile / Trend / ProviderInfo / response envelopes
├── parse.go            fxtwitter + syndication parsers + Twitter date parser
├── providers.go        Composable / Syndication / Nitter / RSS providers + ProviderRegistry
├── handlers.go          150+ HTTP handlers grouped by router
├── routes.go           tiny custom {param} router + middleware + route registration
└── README.md           this file
```

### Why a custom router?

Go 1.21's `net/http.ServeMux` doesn't support the `{param}` path syntax (that
arrived in Go 1.22). To stay on `go 1.21` per the requirement while still
writing readable patterns like `/posts/{tweet_id}`, `routes.go` ships a tiny
custom `Router` that:

- splits a pattern into segments,
- matches each segment literally OR captures it as a path param when wrapped in `{...}`,
- stores captured params in the request context (retrievable via `pathParam(r, "name")`).

Routes are matched in registration order, so static sub-paths (e.g. `/posts/ids`)
must be registered before dynamic catch-alls (e.g. `/posts/{tweet_id}`).

---

## Deployment notes

The Go binary is fully self-contained — no runtime dependencies, no shared
libraries, no external services. It runs anywhere Go compiles:

### Fly.io

```bash
fly launch --image golang:1.21
fly deploy
```

### Railway

```bash
railway up
# Set PORT env var to whatever Railway assigns (or use $PORT default)
```

### Docker

```dockerfile
FROM golang:1.21 AS build
WORKDIR /src
COPY . .
RUN CGO_ENABLED=0 go build -o /blitzyxsc .

FROM gcr.io/distroless/static
COPY --from=build /blitzyxsc /blitzyxsc
EXPOSE 8080
ENTRYPOINT ["/blitzyxsc"]
```

```bash
docker build -t blitzyxsc .
docker run -p 8080:8080 blitzyxsc
```

### VPS (systemd)

```bash
sudo cp blitzyxsc /usr/local/bin/
sudo tee /etc/systemd/system/blitzyxsc.service <<'EOF'
[Unit]
Description=blitzyxsc — X/Twitter free API
After=network.target

[Service]
ExecStart=/usr/local/bin/blitzyxsc
Environment=PORT=8080
Restart=always
User=nobody

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now blitzyxsc
```

### Why not Vercel / serverless?

Vercel is serverless — each request runs in a fresh runtime. The Go binary is
designed as a long-running server (HTTP keepalive, in-process provider pool,
request logging). For Vercel, use the TypeScript Next.js mirror at
`blitzyxsc/ts/` instead.

---

## License

MIT © Blitz / [@blitzlabx](https://x.com/blitzlabx)

This project uses **only public, auth-free endpoints** — fxtwitter, Twitter's
syndication CDN, and public Nitter mirrors. No official X API is used. No
accounts, no tokens, no API keys. Use responsibly.

> ⚠️ Nitter instances are operated by volunteers and may go up/down without
> notice. The provider router handles this automatically — if one Nitter
> mirror is down, the next is tried. If all Nitter mirrors are down, the RSS
> provider delegates to whatever is reachable.

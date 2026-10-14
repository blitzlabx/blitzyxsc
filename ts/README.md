# blitzyxsc

> Auth-free X/Twitter scraping API — TypeScript / Next.js mirror of the Python FastAPI service.

**blitzyxsc** is a multi-provider router that scrapes public X/Twitter data
without authentication, API keys, or risk of account ban. It tries each public
endpoint (fxtwitter → syndication → Nitter → RSS) in priority order and
returns the first successful response — falling back gracefully when one
source is rate-limited or down.

By [@blitzlabx](https://x.com/blitzlabx) • MIT • v1.0.0

---

## What this is

This is the **TypeScript / Next.js 16 mirror** of the primary Python FastAPI
service (in `../py`). It implements the same multi-provider router pattern
and returns the same JSON envelope shapes — so the two deployments are
interchangeable from a client perspective.

| Python (FastAPI)        | TypeScript (Next.js)        |
| ----------------------- | --------------------------- |
| `blitzyxsc_api/`        | `app/api/` + `lib/`         |
| `pydantic` models       | TS interfaces in `lib/schemas.ts` |
| `httpx.AsyncClient`     | `fetch` + `AbortSignal.timeout` |
| `ProviderRegistry`      | `lib/providers.ts` `ProviderRegistry` |
| FastAPI middleware      | Per-route `brandHeaders()`  |
| `vercel.json` + uvicorn | `next start` (serverless)   |

## Features

- **Multi-provider router** — `composable` (fxtwitter) → `syndication` → `nitter` → `rss`
- **No auth, no keys** — public guest endpoints only (no account ban risk)
- **CORS-enabled** — `Access-Control-Allow-Origin: *` on every response
- **Branded headers** — `X-Powered-By: blitzyxsc 1.0.0` + `X-Author: blitzlabx`
- **Vercel-ready** — Next.js 16 App Router, `output: "standalone"`
- **Interactive playground** — single-page client UI at `/playground` listing
  ~80 endpoints with deep-linking, JSON syntax highlighting, and copy-to-clipboard
- **Docs page** — branded endpoint reference at `/docs`

## Quick start

```bash
# install
npm install

# run dev server
npm run dev
# → http://localhost:3000

# build for production (Vercel)
npm run build
npm start
```

Then visit:

- `/` — branded landing page
- `/docs` — endpoint reference (grouped by router)
- `/playground` — interactive request builder
- `/api/health` — service health + provider status
- `/api/providers` — provider priority list
- `/api/posts/{tweet_id}` — single tweet
- `/api/posts/user/{username}` — user timeline
- `/api/profile/{username}` — profile
- `/api/search?q=...` — keyword search
- `/api/replies/{tweet_id}` — replies
- `/api/mentions/{username}` — mentions
- `/api/trends` — trends
- `/api/media/tweet/{tweet_id}` — media attached to a tweet
- `/api/quotes/{tweet_id}` — quote tweets

## Example responses

```bash
curl http://localhost:3000/api/health
# {
#   "status": "ok",
#   "brand": "blitzyxsc",
#   "version": "1.0.0",
#   "author": "Blitz <blitzlabx>",
#   "providers": ["composable", "syndication", "nitter", "rss"],
#   "uptime_seconds": 12.34
# }

curl http://localhost:3000/api/profile/elonmusk
# {
#   "data": {
#     "id": "44196397",
#     "username": "elonmusk",
#     "display_name": "Elon Musk",
#     "bio": "http://Terafab.AI",
#     "followers": 241501385,
#     "following": 1421,
#     "tweets_count": 110150,
#     "likes_count": 252788,
#     "verified": true,
#     ...
#   },
#   "provider": { "name": "composable", "ok": true, "latency_ms": 250.35 }
# }

curl http://localhost:3000/api/posts/20
# {
#   "data": {
#     "id": "20",
#     "text": "just setting up my twttr",
#     "author": { "username": "jack", "display_name": "jack" },
#     "created_at": "2006-03-21T20:50:14Z",
#     "reply_count": 18089,
#     "retweet_count": 124640,
#     "like_count": 309872,
#     ...
#   },
#   "provider": { "name": "composable", "ok": true, "latency_ms": 250.35 }
# }
```

## Project structure

```
ts/
├── app/
│   ├── api/
│   │   ├── health/route.ts                 # GET /api/health
│   │   ├── providers/route.ts              # GET /api/providers
│   │   ├── posts/[tweet_id]/route.ts       # GET /api/posts/{tweet_id}
│   │   ├── posts/user/[username]/route.ts  # GET /api/posts/user/{username}
│   │   ├── profile/[username]/route.ts     # GET /api/profile/{username}
│   │   ├── search/route.ts                 # GET /api/search
│   │   ├── replies/[tweet_id]/route.ts     # GET /api/replies/{tweet_id}
│   │   ├── mentions/[username]/route.ts    # GET /api/mentions/{username}
│   │   ├── trends/route.ts                 # GET /api/trends
│   │   ├── media/tweet/[tweet_id]/route.ts # GET /api/media/tweet/{tweet_id}
│   │   └── quotes/[tweet_id]/route.ts      # GET /api/quotes/{tweet_id}
│   ├── docs/page.tsx                       # endpoint reference
│   ├── playground/page.tsx                 # interactive playground
│   ├── layout.tsx                          # root layout + brand metadata
│   ├── page.tsx                            # landing page
│   └── globals.css                         # theme tokens + JSON syntax colors
├── lib/
│   ├── config.ts                           # BLITZYXSC_* env loader + brandHeaders()
│   ├── schemas.ts                          # TS interfaces mirroring Pydantic models
│   ├── providers.ts                        # ComposableProvider / SyndicationProvider / NitterProvider / RSSProvider + ProviderRegistry
│   ├── http.ts                             # shared JSON / CORS / preflight helpers
│   └── endpoints.ts                        # ~80 endpoint defs shared by docs + playground
├── next.config.js
├── tsconfig.json
├── package.json
├── .env.example
└── README.md
```

## Providers

| Priority | Provider | Source | Auth | Notes |
| --- | --- | --- | --- | --- |
| 1 | `composable` | `https://api.fxtwitter.com` | none | fxtwitter JSON; requires real UA header |
| 2 | `syndication` | `https://cdn.syndication.twimg.com` | none | Twitter's own public embed CDN |
| 3 | `nitter` | 8 Nitter mirror instances | none | RSS / HTML parse; first 200 wins |
| 4 | `rss` | `publish.twitter.com/oembed` + Nitter | none | Last-resort fallback |

Override the priority via `BLITZYXSC_PROVIDER_ORDER=composable,syndication,nitter,rss`.

## Configuration

All settings come from environment variables prefixed `BLITZYXSC_`. See
`.env.example` for the full list. Key ones:

| Env var | Default | Description |
| --- | --- | --- |
| `BLITZYXSC_PROVIDER_ORDER` | `composable,syndication,nitter,rss` | Provider priority order |
| `BLITZYXSC_NITTER_INSTANCES` | 8 default mirrors | Comma-separated Nitter instances |
| `BLITZYXSC_USER_AGENT` | Chrome 120 desktop | Required by fxtwitter (403 otherwise) |
| `BLITZYXSC_MAX_PAGE_SIZE` | `100` | Upper bound on `limit` query params |

## Deploy to Vercel

```bash
# 1. install the Vercel CLI if you don't have it
npm i -g vercel

# 2. deploy from the ts/ directory
cd ts && vercel
```

The `next.config.js` ships with `output: "standalone"` so the function
bundle stays tiny. No env vars are required for the default deployment —
all settings have sensible defaults baked into `lib/config.ts`.

## Branding

- **Package name**: `blitzyxsc`
- **Author**: `Blitz <blitzlabx>`
- **License**: MIT
- **Headers**: every API response includes
  `X-Powered-By: blitzyxsc 1.0.0` + `X-Author: blitzlabx`
- **Links**: [`https://x.com/blitzlabx`](https://x.com/blitzlabx)

## License

MIT © Blitz ([@blitzlabx](https://x.com/blitzlabx))

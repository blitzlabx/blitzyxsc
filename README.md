# ⚡ blitzyxsc

**Auth-free X/Twitter scraping API** — by [**Blitz**](https://x.com/blitzlabx) (`@blitzlabx`)

Multi-provider, multi-language, no-auth, no-rate-limit, no-account-ban. Uses **only public guest endpoints** (fxtwitter, Twitter syndication CDN, Nitter mirrors, twscrape, snscrape, RSS).

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Go](https://img.shields.io/badge/Go-1.21%2B-00ADD8)](https://go.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Version](https://img.shields.io/badge/version-1.0.0-purple)](#)

---

## 📖 Table of Contents

1. [What is blitzyxsc?](#what-is-blitzyxsc)
2. [Key features](#key-features)
3. [Quick start](#quick-start)
4. [Multi-language implementations](#multi-language-implementations)
5. [Architecture](#architecture)
6. [Providers (sources)](#providers-sources)
7. [Endpoints](#endpoints)
8. [Live response examples](#live-response-examples)
9. [Configuration](#configuration)
10. [Deployment](#deployment)
11. [Testing](#testing)
12. [Playground UI](#playground-ui)
13. [Postman collection](#postman-collection)
14. [Disclaimer](#disclaimer)
15. [Credits](#credits)

---

## What is blitzyxsc?

`blitzyxsc` is a unified, **authentication-free** REST API for fetching data from X (formerly Twitter) — posts, replies, comments, mentions, profiles, search, trends, media, and quotes — without using the official X API and without putting your account at risk of bans or rate limits.

It works by **fanning out** each request across multiple public, unauthenticated sources and returning the first successful response. If one source is rate-limited or down, the next one picks up automatically.

Built by **Blitz** (`@blitzlabx` on every platform — X, GitHub, etc.). Available in 4 languages: **Python (FastAPI)**, **TypeScript (Next.js)**, **Node.js (Express)**, and **Go** — pick whichever fits your stack.

## Key features

- 🔓 **No auth required** — uses public guest endpoints only; no API keys, no OAuth tokens, no account credentials
- 🛡️ **No ban risk** — does not hit the official X API, does not require login, does not scrape authenticated pages
- 🔄 **Multi-provider fallback** — tries 6 different public sources per request: fxtwitter (composable), Twitter syndication CDN, Nitter mirrors, twscrape, snscrape, RSS. First success wins.
- 🌐 **CORS-enabled** — drop-in for any frontend (React, Vue, Svelte, vanilla JS)
- 📊 **220+ endpoints** across 8 routers: Posts & Timeline, Search, Profile, Replies & Comments, Mentions, Trends, Media, Quotes
- 🚀 **Vercel-ready** — the Python FastAPI deploys as a serverless function out-of-the-box (`vercel deploy`)
- 🎨 **Interactive playground** — built-in web UI to test every endpoint without writing code
- 📚 **Comprehensive docs** — interactive Swagger UI at `/docs`, ReDoc at `/redoc`, plus this README, MDX docs, and a Postman collection
- 🏷️ **Branded everywhere** — package name, binary name, Docker image, CLI command, env vars, response headers all carry the `blitzyxsc` brand

## Quick start

### Get the code

```bash
git clone https://github.com/blitzlabx/blitzyxsc.git
cd blitzyxsc
```

Or download the latest release zip from <https://github.com/blitzlabx/blitzyxsc/releases>.

Then pick whichever language edition you want:

### Option A — Python (FastAPI) — primary

```bash
cd py
pip install -r requirements.txt
uvicorn blitzyxsc_api.main:app --reload
# → http://localhost:8000
# → http://localhost:8000/docs        (Swagger UI)
# → http://localhost:8000/playground  (interactive tester)
```

### Option B — TypeScript (Next.js)

```bash
cd ts
npm install
npm run dev
# → http://localhost:3000
# → http://localhost:3000/playground
```

### Option C — Node.js (Express)

```bash
cd node
npm install
npm start
# → http://localhost:3001
# → http://localhost:3001/playground
```

### Option D — Go (single binary)

```bash
cd go
go build -o blitzyxsc .
./blitzyxsc
# → http://localhost:8080
```

### Docker (Python edition)

```bash
cd py
docker build -t blitzyxsc .
docker run -p 8000:8000 blitzyxsc
```

## Multi-language implementations

| Language | Framework | Location | Port | Vercel-ready? | Endpoints |
|----------|-----------|----------|------|---------------|-----------|
| **Python** | FastAPI | `py/` | 8000 | ✅ | 220+ |
| **TypeScript** | Next.js 16 | `ts/` | 3000 | ✅ | 80+ |
| **Node.js** | Express 4 | `node/` | 3001 | ❌ (long-running) | 152 |
| **Go** | net/http (stdlib) | `go/` | 8080 | ❌ (binary) | 152 |

All four implementations return **identical JSON shapes** for the same endpoint, so you can swap one for another without changing your client code.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Client (curl, fetch, etc.)              │
└─────────────────────────────────┬─────────────────────────────┘
                                  │
                                  ▼
┌──────────────────────────────────────────────────────────────┐
│                   blitzyxsc API server                        │
│   (FastAPI / Next.js / Express / Go — pick your flavor)       │
│                                                                │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │  Router layer — 220+ endpoints across 8 routers          │ │
│   │  posts / search / profile / replies / mentions / trends  │ │
│   │  media / quotes                                           │ │
│   └─────────────────┬──────────────────────────────────────┘ │
│                     │                                          │
│                     ▼                                          │
│   ┌──────────────────────────────────────────────────────────┐ │
│   │  Provider registry — call_with_fallback()                │ │
│   │  Tries each provider in priority order:                  │ │
│   │                                                          │ │
│   │   1. composable (fxtwitter)                              │ │
│   │   2. syndication (Twitter CDN)                           │ │
│   │   3. nitter (public mirrors)                             │ │
│   │   4. twscrape (if installed)                             │ │
│   │   5. snscrape (if installed)                             │ │
│   │   6. rss (oEmbed fallback)                               │ │
│   │                                                          │ │
│   │  First success → return result + provider info           │ │
│   └─────────────────┬──────────────────────────────────────┘ │
└─────────────────────┼────────────────────────────────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                Public X data sources                         │
│                                                                │
│  • api.fxtwitter.com (no auth, needs User-Agent)              │
│  • cdn.syndication.twimg.com (Twitter embed CDN, no auth)     │
│  • nitter.meowing.monster / nitter.poast.org / ... (RSS+HTML)│
│  • publish.twitter.com/oembed (oEmbed fallback)               │
└──────────────────────────────────────────────────────────────┘
```

## Providers (sources)

Each provider is a Python class (or TS/JS/Go equivalent) that implements the same interface (`get_tweet`, `get_profile`, `get_user_tweets`, `search_tweets`, `get_replies`, `get_mentions`, `get_trends`). The registry iterates providers in priority order and returns the first success.

### 1. Composable / fxtwitter (`composable`)

- **URL**: `https://api.fxtwitter.com/{username}` and `/status/{tweet_id}`
- **Auth**: none, but requires a real User-Agent header (otherwise returns 403)
- **Strengths**: reliable JSON responses, rich tweet metadata, full profile data
- **Weaknesses**: only serves single tweets and profiles — no search, no trends
- **Priority**: 1 (always tried first)

### 2. Twitter syndication CDN (`syndication`)

- **URL**: `https://cdn.syndication.twimg.com/tweet-result?id={id}&token=0`
- **Auth**: none
- **Strengths**: Twitter's own public embed API, very fast, serves tweet JSON with engagement counts
- **Weaknesses**: only serves individual tweets, no profiles or search
- **Priority**: 2

### 3. Nitter mirrors (`nitter`)

- **URLs** (tried in order):
  - `https://nitter.meowing.monster` (most reliable as of 2026-10)
  - `https://nitter.poast.org`
  - `https://nitter.privacydev.net`
  - `https://nitter.cz`
  - `https://nitter.woodland.cafe`
  - `https://nitter.1d4.us`
  - `https://nitter.kavin.rocks`
  - `https://nitter.unixfox.eu`
- **Auth**: none
- **Strengths**: serves user timelines as RSS, full-text search, trends, HTML scraping
- **Weaknesses**: Nitter instances go up and down — that's why we try multiple
- **Priority**: 3

### 4. twscrape (`twscrape`) — optional

- **Install**: `pip install twscrape`
- **Auth**: uses guest accounts (you provision them with `twscrape add_account`)
- **Strengths**: full Twitter GraphQL access via guest tokens, supports search, replies, quotes
- **Weaknesses**: requires account setup, guest tokens get rate-limited over time
- **Priority**: 4 (raises `ProviderError` immediately if not installed — registry falls through)

### 5. snscrape (`snscrape`) — optional

- **Install**: `pip install snscrape`
- **Auth**: none
- **Strengths**: historically the gold standard for Twitter scraping
- **Weaknesses**: largely defunct post-2023 (Twitter killed the public endpoints it used); kept as a legacy fallback
- **Priority**: 5

### 6. RSS / oEmbed (`rss`)

- **URL**: `https://publish.twitter.com/oembed?url=...`
- **Auth**: none
- **Strengths**: Twitter's official oEmbed API still works for profile lookups
- **Weaknesses**: returns minimal data (display name + HTML snippet only)
- **Priority**: 6 (last resort)

## Endpoints

**Total: 220 endpoints** across 8 routers. Full list with response schemas is at `/docs` (Swagger UI) on any running instance.

### Posts & Timeline (`/posts`) — 35 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /posts/{tweet_id}` | Get a single tweet by ID |
| `GET /posts/user/{username}` | Get tweets from a user's timeline |
| `GET /posts/user/{username}/latest` | Alias of above |
| `GET /posts/user/{username}/media` | Tweets containing media |
| `GET /posts/user/{username}/photos` | Tweets containing photos |
| `GET /posts/user/{username}/videos` | Tweets containing videos |
| `GET /posts/user/{username}/gifs` | Tweets containing animated GIFs |
| `GET /posts/user/{username}/replies` | Tweets that are replies |
| `GET /posts/user/{username}/original` | Original tweets (no replies, no retweets) |
| `GET /posts/user/{username}/retweets` | Retweets |
| `GET /posts/user/{username}/quotes` | Quote-tweets |
| `GET /posts/user/{username}/text-only` | Text-only tweets |
| `GET /posts/user/{username}/verified` | From verified users |
| `GET /posts/user/{username}/pinned` | User's pinned tweet |
| `GET /posts/id/{tweet_id}/raw` | Raw tweet data |
| `GET /posts/id/{tweet_id}/text` | Just the text |
| `GET /posts/id/{tweet_id}/author` | Just the author |
| `GET /posts/id/{tweet_id}/stats` | Engagement stats |
| `GET /posts/id/{tweet_id}/hashtags` | Hashtags used |
| `GET /posts/id/{tweet_id}/mentions` | Users mentioned |
| `GET /posts/id/{tweet_id}/urls` | URLs contained |
| `GET /posts/id/{tweet_id}/conversation` | Conversation thread |
| `GET /posts/id/{tweet_id}/quoted` | Tweet quoted by this one |
| `GET /posts/id/{tweet_id}/retweeted` | Tweet retweeted by this one |
| `GET /posts/ids` | Bulk fetch (comma-separated IDs) |
| `GET /posts/by-date` | Filter by date range |
| `GET /posts/by-language` | Filter by language |
| `GET /posts/by-hashtag` | Filter by hashtag |
| `GET /posts/by-mention` | Filter by mention |
| `GET /posts/by-min-likes` | Filter by minimum likes |
| `GET /posts/by-min-retweets` | Filter by minimum retweets |
| `GET /posts/by-min-views` | Filter by minimum views |
| `GET /posts/popular/{username}` | Most popular tweets |
| `GET /posts/by-source` | Filter by source app |
| `GET /posts/sensitive/{username}` | Sensitive tweets |
| `GET /posts/clean/{username}` | Non-sensitive tweets |

### Search (`/search`) — 30 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /search?q=...` | Standard keyword search |
| `GET /search/latest` | Latest tweets |
| `GET /search/top` | Most popular |
| `GET /search/advanced` | Advanced search with structured filters |
| `GET /search/people` | Tweets mentioning people |
| `GET /search/photos` | Tweets with photos |
| `GET /search/videos` | Tweets with videos |
| `GET /search/news` | Tweets with news links |
| `GET /search/gifs` | Tweets with GIFs |
| `GET /search/links` | Tweets with URLs |
| `GET /search/questions` | Tweets that are questions (?) |
| `GET /search/positive` | Tweets with :) markers |
| `GET /search/negative` | Tweets with :( markers |
| `GET /search/hashtag/{hashtag}` | By hashtag |
| `GET /search/cashtag/{cashtag}` | By cashtag ($STOCK) |
| `GET /search/mention/{username}` | Tweets mentioning a user |
| `GET /search/from/{username}` | Tweets from a user |
| `GET /search/to/{username}` | Tweets directed to a user |
| `GET /search/since/{date}` | Tweets since a date |
| `GET /search/until/{date}` | Tweets until a date |
| `GET /search/lang/{lang}` | Tweets in a language |
| `GET /search/geocode/{geocode}` | Tweets near a geocode |
| `GET /search/near/{place}` | Tweets near a place |
| `GET /search/min-faves/{min_faves}` | Tweets with at least N likes |
| `GET /search/min-retweets/{min_retweets}` | Tweets with at least N retweets |
| `GET /search/min-replies/{min_replies}` | Tweets with at least N replies |
| `GET /search/verified` | From verified accounts |
| `GET /search/no-retweets` | Excluding retweets |
| `GET /search/no-replies` | Excluding replies |
| `GET /search/safe` | Excluding sensitive content |
| `GET /search/original` | Only original tweets |

### Profile (`/profile`) — 30 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /profile/{username}` | Full profile |
| `GET /profile/{username}/bio` | Bio only |
| `GET /profile/{username}/avatar` | Avatar URL |
| `GET /profile/{username}/banner` | Banner URL |
| `GET /profile/{username}/display-name` | Display name |
| `GET /profile/{username}/location` | Location |
| `GET /profile/{username}/website` | Website |
| `GET /profile/{username}/stats` | Followers/following/tweets/likes |
| `GET /profile/{username}/followers` | Follower count |
| `GET /profile/{username}/following` | Following count |
| `GET /profile/{username}/tweets-count` | Tweet count |
| `GET /profile/{username}/likes-count` | Like count |
| `GET /profile/{username}/listed-count` | Listed count |
| `GET /profile/{username}/verified` | Verified status |
| `GET /profile/{username}/protected` | Protected status |
| `GET /profile/{username}/joined` | Join date |
| `GET /profile/{username}/id` | Internal ID |
| `GET /profile/{username}/summary` | Short text summary |
| `GET /profile/{username}/pinned` | Pinned tweet |
| `GET /profile/{username}/exists` | Username exists? |
| `GET /profile/{username}/combined` | Profile + recent tweets |
| `GET /profile/{username}/ratio` | Follower/following ratio |
| `GET /profile/{username}/influence-score` | Influence score (0-100) |
| `GET /profile/{username}/age` | Account age in days |
| `GET /profile/{username}/avatar-hd` | HD avatar URL |
| `GET /profile/{username}/banner-hd` | HD banner URL |
| `GET /profile/bulk` | Bulk profiles |

### Replies & Comments (`/replies`) — 25 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /replies/{tweet_id}` | Replies to a tweet |
| `GET /replies/{tweet_id}/latest` | Latest replies |
| `GET /replies/{tweet_id}/tree` | Full reply tree |
| `GET /replies/{tweet_id}/count` | Reply count |
| `GET /replies/{tweet_id}/by-verified` | From verified accounts |
| `GET /replies/{tweet_id}/by-author` | From the original author |
| `GET /replies/{tweet_id}/by-followers` | From followers (heuristic) |
| `GET /replies/{tweet_id}/by-influencers` | From high-follower accounts |
| `GET /replies/{tweet_id}/with-media` | With media |
| `GET /replies/{tweet_id}/with-photos` | With photos |
| `GET /replies/{tweet_id}/with-videos` | With videos |
| `GET /replies/{tweet_id}/with-links` | With URLs |
| `GET /replies/{tweet_id}/popular` | Most liked |
| `GET /replies/{tweet_id}/controversial` | Most engagement (replies + retweets) |
| `GET /replies/{tweet_id}/positive` | Positive sentiment |
| `GET /replies/{tweet_id}/negative` | Negative sentiment |
| `GET /replies/{tweet_id}/questions` | Question replies |
| `GET /replies/{tweet_id}/by-lang/{lang}` | In a language |
| `GET /replies/{tweet_id}/oldest` | Oldest replies |
| `GET /replies/{tweet_id}/thread` | Self-reply thread |
| `GET /replies/{tweet_id}/quoted` | Quote tweets of this tweet |
| `GET /replies/{tweet_id}/context` | Parent tweet + replies |
| `GET /replies/{tweet_id}/conversation-id` | Conversation ID |
| `GET /replies/{tweet_id}/root` | Root of conversation |

### Mentions (`/mentions`) — 15 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /mentions/{username}` | Tweets mentioning a user |
| `GET /mentions/{username}/latest` | Latest mentions |
| `GET /mentions/{username}/top` | Top mentions (most liked) |
| `GET /mentions/{username}/from-verified` | From verified accounts |
| `GET /mentions/{username}/with-media` | With media |
| `GET /mentions/{username}/with-photos` | With photos |
| `GET /mentions/{username}/with-videos` | With videos |
| `GET /mentions/{username}/with-links` | With URLs |
| `GET /mentions/{username}/by-lang/{lang}` | In a language |
| `GET /mentions/{username}/since/{since}` | Since a date |
| `GET /mentions/{username}/until/{until}` | Until a date |
| `GET /mentions/{username}/questions` | Question mentions |
| `GET /mentions/{username}/positive` | Positive mentions |
| `GET /mentions/{username}/negative` | Negative mentions |
| `GET /mentions/{username}/count` | Mention count |

### Trends (`/trends`) — 15 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /trends` | Current trends |
| `GET /trends/global` | Global trends (woeid=1) |
| `GET /trends/worldwide` | Alias of `/trends/global` |
| `GET /trends/us` | US trends |
| `GET /trends/uk` | UK trends |
| `GET /trends/japan` | Japan trends |
| `GET /trends/india` | India trends |
| `GET /trends/brazil` | Brazil trends |
| `GET /trends/germany` | Germany trends |
| `GET /trends/france` | France trends |
| `GET /trends/canada` | Canada trends |
| `GET /trends/australia` | Australia trends |
| `GET /trends/nigeria` | Nigeria trends |
| `GET /trends/top/{n}` | Top N trends |
| `GET /trends/by-volume` | Sorted by tweet volume |

### Media (`/media`) — 20 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /media/tweet/{tweet_id}` | All media in a tweet |
| `GET /media/tweet/{tweet_id}/photos` | Photos only |
| `GET /media/tweet/{tweet_id}/videos` | Videos only |
| `GET /media/tweet/{tweet_id}/gifs` | GIFs only |
| `GET /media/tweet/{tweet_id}/first-photo` | First photo |
| `GET /media/tweet/{tweet_id}/first-video` | First video |
| `GET /media/tweet/{tweet_id}/thumbnails` | All thumbnails |
| `GET /media/tweet/{tweet_id}/count` | Media count |
| `GET /media/user/{username}` | Tweets with media from a user |
| `GET /media/user/{username}/photos` | Tweets with photos from a user |
| `GET /media/user/{username}/videos` | Tweets with videos from a user |
| `GET /media/user/{username}/all-photos` | All photo URLs |
| `GET /media/user/{username}/all-videos` | All video URLs |
| `GET /media/user/{username}/avatar` | Avatar URL |
| `GET /media/user/{username}/banner` | Banner URL |
| `GET /media/user/{username}/avatar-hd` | HD avatar URL |
| `GET /media/search` | Search tweets with media |
| `GET /media/user/{username}/most-viewed` | Most-viewed media tweets |

### Quotes (`/quotes`) — 15 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /quotes/{tweet_id}` | Quote tweets of a tweet |
| `GET /quotes/{tweet_id}/latest` | Latest quote tweets |
| `GET /quotes/{tweet_id}/top` | Top quote tweets (most liked) |
| `GET /quotes/{tweet_id}/by-verified` | From verified accounts |
| `GET /quotes/{tweet_id}/with-media` | With media |
| `GET /quotes/{tweet_id}/with-photos` | With photos |
| `GET /quotes/{tweet_id}/with-videos` | With videos |
| `GET /quotes/{tweet_id}/positive` | Positive quotes |
| `GET /quotes/{tweet_id}/negative` | Negative quotes |
| `GET /quotes/{tweet_id}/by-lang/{lang}` | In a language |
| `GET /quotes/{tweet_id}/count` | Quote count |
| `GET /quotes/{tweet_id}/since/{since}` | Since a date |
| `GET /quotes/{tweet_id}/until/{until}` | Until a date |
| `GET /quotes/{tweet_id}/oldest` | Oldest quotes |
| `GET /quotes/{tweet_id}/context` | Original quoted tweet |

### Meta (`/`) — 5 endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /` | Landing page |
| `GET /health` | Health check + provider status |
| `GET /providers` | List configured providers + priority |
| `GET /providers/health` | Live probe of each provider |
| `GET /playground` | Interactive playground UI |

## Live response examples

These screenshots were captured by hitting a real running blitzyxsc instance against live public X data sources. See `docs/screenshots/` for the full set.

### `GET /health`

```
Status: 200
X-Powered-By: blitzyxsc 1.0.0
X-Author: blitzlabx

{
  "status": "ok",
  "brand": "blitzyxsc",
  "version": "1.0.0",
  "author": "Blitz <blitzlabx>",
  "providers": ["syndication", "nitter", "composable", "twscrape", "snscrape", "rss"],
  "uptime_seconds": 2.653
}
```

### `GET /profile/elonmusk`

```
Status: 200
X-Powered-By: blitzyxsc 1.0.0
X-Author: blitzlabx

{
  "data": {
    "id": "44196397",
    "username": "elonmusk",
    "display_name": "Elon Musk",
    "bio": "http://Terafab.AI",
    "location": "",
    "website": "https://x.com/elonmusk",
    "avatar": "https://pbs.twimg.com/profile_images/2103567689515954176/aR-Kjpp4_normal.jpg",
    "banner": "https://pbs.twimg.com/profile_banners/44196397/1774145451",
    "followers": 241501385,
    "following": 1421,
    "tweets_count": 110150,
    "likes_count": 252788,
    "verified": true,
    "protected": false
  },
  "provider": {
    "name": "composable",
    "ok": true,
    "latency_ms": 265.11
  }
}
```

### `GET /posts/20` (Jack Dorsey's first tweet)

```
Status: 200
X-Powered-By: blitzyxsc 1.0.0
X-Author: blitzlabx

{
  "data": {
    "id": "20",
    "text": "just setting up my twttr",
    "author": {
      "id": "12",
      "username": "jack",
      "display_name": "jack",
      "avatar": "https://pbs.twimg.com/profile_images/1661201415899951105/azNjKOSH_200x200.jpg"
    },
    "created_at": "2006-03-21T20:50:14Z",
    "language": "en",
    "reply_count": 18089,
    "retweet_count": 124640,
    "like_count": 309872,
    "quote_count": 7308,
    "url": "https://x.com/jack/status/20"
  },
  "provider": {
    "name": "composable",
    "ok": true,
    "latency_ms": 254.32
  }
}
```

### `GET /posts/user/elonmusk?limit=3`

Returns the 3 most recent tweets from @elonmusk — see `docs/screenshots/timeline-elonmusk.txt`.

### `GET /profile/elonmusk/summary`

```
Status: 200

Elon Musk (@elonmusk)
Verified account
http://Terafab.AI
Followers: 241,501,385
Following: 1,421
Tweets: 110,150
```

### `GET /profile/elonmusk/ratio`

```
Status: 200

{
  "ratio": 170092.46,
  "followers": 241501385,
  "following": 1421
}
```

## Configuration

All settings come from environment variables prefixed with `BLITZYXSC_`. See `.env.example` files in each language directory.

| Env var | Default | Description |
|---------|---------|-------------|
| `BLITZYXSC_PORT` | `8000` | Port to listen on |
| `BLITZYXSC_CORS_ORIGINS` | `["*"]` | JSON array of allowed origins |
| `BLITZYXSC_PROVIDER_ORDER` | `["composable","syndication","nitter","twscrape","snscrape","rss"]` | Provider priority order |
| `BLITZYXSC_NITTER_INSTANCES` | (see config) | JSON array of Nitter base URLs |
| `BLITZYXSC_DEFAULT_PAGE_SIZE` | `20` | Default page size |
| `BLITZYXSC_MAX_PAGE_SIZE` | `100` | Max page size |
| `BLITZYXSC_USER_AGENT` | (real Chrome UA) | User-Agent header sent to upstream sources |
| `BLITZYXSC_TWSCRAPE_DB` | `/tmp/blitzyxsc_twscrape.db` | SQLite path for twscrape account pool |

## Deployment

### Vercel (Python FastAPI — primary)

```bash
cd py
vercel deploy
```

The included `vercel.json` configures the build. No additional setup required.

### Vercel (TypeScript Next.js)

```bash
cd ts
vercel deploy
```

### Docker (Python)

```bash
cd py
docker build -t blitzyxsc .
docker run -p 8000:8000 blitzyxsc
```

### Railway / Render / Fly.io (Node.js Express)

```bash
cd node
railway up   # or fly deploy, etc.
```

### VPS / bare metal (Go)

```bash
cd go
go build -o blitzyxsc .
scp blitzyxsc user@server:/usr/local/bin/
ssh user@server 'nohup blitzyxsc > /var/log/blitzyxsc.log 2>&1 &'
```

## Testing

Each language has its own test suite. The Python suite is the most complete:

### Python unit + live smoke tests

```bash
cd py
pip install -r requirements.txt
pytest tests/ -v
```

Sample output:

```
tests/test_unit.py::test_tweet_schema_roundtrip PASSED
tests/test_unit.py::test_provider_fallback_picks_first_success PASSED
tests/test_unit.py::test_provider_fallback_raises_when_all_fail PASSED
tests/test_live.py::test_health_endpoint PASSED
tests/test_live.py::test_live_get_profile PASSED
tests/test_live.py::test_live_get_tweet PASSED
tests/test_live.py::test_live_search PASSED
tests/test_live.py::test_live_user_timeline PASSED
tests/test_live.py::test_live_trends PASSED
...
======================== 19 passed in 6.00s ========================
```

### TypeScript build

```bash
cd ts
npm install
npm run build  # 0 errors, 0 warnings
```

### Node.js Express smoke test

```bash
cd node
npm install
npm start &
curl http://localhost:3001/health
curl http://localhost:3001/profile/elonmusk
curl http://localhost:3001/posts/20
```

### Go build + smoke test

```bash
cd go
go build -o blitzyxsc .
./blitzyxsc &
curl http://localhost:8080/health
curl http://localhost:8080/profile/elonmusk
curl http://localhost:8080/posts/20
```

## Playground UI

Every implementation ships with an interactive playground at `/playground`. It's a single-page web UI that:

1. Lists every endpoint in a sidebar (grouped by router)
2. Lets you fill in path params and query params
3. Sends the request and shows the JSON response with syntax highlighting
4. Reports the latency, status code, and which provider served the request

The Python playground is a standalone HTML file at `py/playground.html` — copy it anywhere and point it at any blitzyxsc instance by changing the base URL.

## Postman collection

A Postman v2.1 collection is included at `docs/postman_collection.json`. It contains all 220 endpoints organized into 10 folders (Posts, Search, Profile, Replies, Mentions, Trends, Media, Quotes, Meta, etc.) with pre-filled `{{base_url}}` variables.

**To import:**
1. Open Postman
2. Click "Import"
3. Select `docs/postman_collection.json`
4. Set the `base_url` variable to your blitzyxsc deployment URL
5. Start firing requests

## Disclaimer

**blitzyxsc is not affiliated with, endorsed by, or sponsored by X Corp.** It is an independent project that uses public, unauthenticated endpoints to fetch publicly-available data. It does not:
- Use the official X API
- Require login credentials
- Hit authenticated pages
- Bypass rate limits or access controls
- Store or cache user data

Use responsibly and in accordance with the terms of service of the upstream sources (X, Nitter instances, fxtwitter). The author (`@blitzlabx`) is not responsible for any misuse.

## Credits

- **Author**: [Blitz](https://x.com/blitzlabx) — `@blitzlabx` on X, GitHub, and every other platform
- **License**: MIT
- **Inspiration**: [FixTweet / fxtwitter](https://github.com/FixTweet/FxTwitter), [nitter](https://github.com/zedeus/nitter), [twscrape](https://github.com/vladkens/twscrape), [snscrape](https://github.com/JustAnotherArchivist/snscrape)
- **Powered by**: FastAPI, Next.js, Express, Go stdlib, httpx, pydantic, TypeScript

---

<p align="center">
  <strong>blitzyxsc</strong> — built by <a href="https://x.com/blitzlabx">Blitz</a> (blitzlabx)<br>
  <a href="https://x.com/blitzlabx">X</a> · <a href="https://github.com/blitzlabx">GitHub</a><br>
  <em>v1.0.0 · MIT License</em>
</p>

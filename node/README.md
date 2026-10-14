# blitzyxsc-express

> **Auth-free X/Twitter scraping API** — Node.js / Express mirror of the FastAPI [blitzyxsc](https://x.com/blitzlabx) service by **Blitz (blitzlabx)**.

`blitzyxsc` is a no-auth X/Twitter API that uses only public guest endpoints
(fxtwitter, syndication, Nitter) — no risk of account ban, no API key required.
This package is the **Node.js / Express** port of the FastAPI source of truth
at `../py/blitzyxsc_api/`. It returns the **same JSON response shape** as the
Python service, so the two deployments are interchangeable client-side.

- 🚀 **Multi-provider router** — tries each source in priority order:
  `composable → syndication → nitter → rss`; first success wins.
- 🔓 **No auth required** — uses public guest endpoints only.
- 🌐 **CORS-enabled** — drop-in for any frontend.
- 📊 **150+ endpoints** across 8 routers (Posts, Search, Profile, Replies,
  Mentions, Trends, Media, Quotes) + meta routes (health, providers, playground).
- 🔄 **Auto-fallback** — if one source is rate-limited or down, the next picks up.
- 🏷️ **Branded everywhere** — every response carries
  `X-Powered-By: blitzyxsc 1.0.0` and `X-Author: blitzlabx`.

## Get the code

```bash
git clone https://github.com/blitzlabx/blitzyxsc.git
cd blitzyxsc/node
```

## Quick start

```bash
npm install
npm start
# ⚡ blitzyxsc v1.0.0 by blitzlabx — listening on http://0.0.0.0:3001
```

Dev mode with auto-reload on file changes:

```bash
npm run dev
```

Then open:

- http://localhost:3001/              — branded landing page
- http://localhost:3001/health        — JSON health check
- http://localhost:3001/providers     — configured provider priority
- http://localhost:3001/providers/health — live probe of every provider
- http://localhost:3001/playground    — interactive playground UI
- http://localhost:3001/posts/20      — fetch tweet ID 20 (jack's "just setting up my twttr")
- http://localhost:3001/profile/elonmusk — fetch Elon Musk's profile

## Configuration

All settings come from environment variables prefixed `BLITZYXSC_`. See
[.env.example](./.env.example) for the full list. The most useful ones:

| Var | Default | Notes |
|---|---|---|
| `BLITZYXSC_PORT` | `3001` | HTTP port to listen on |
| `BLITZYXSC_HOST` | `0.0.0.0` | bind address |
| `BLITZYXSC_PROVIDER_ORDER` | `composable,syndication,nitter,rss` | comma-separated, first success wins |
| `BLITZYXSC_NITTER_INSTANCES` | (8 mirrors) | comma-separated list of Nitter bases |
| `BLITZYXSC_USER_AGENT` | Chrome 120 UA | fxtwitter 403s without a real UA |
| `BLITZYXSC_MAX_PAGE_SIZE` | `100` | hard upper bound for `limit` query |

## Endpoints

Total: **150+ endpoints** across 8 routers. See `/playground` for the full
interactive list. Quick reference:

### Meta
- `GET /`                                  — branded HTML landing page
- `GET /health`                            — health + provider list + uptime
- `GET /providers`                         — configured provider priority
- `GET /providers/health`                  — live probe of every provider
- `GET /playground`                        — interactive playground UI

### Posts & Timeline (`/posts`)
- `GET /posts/:tweet_id`                   — fetch a single tweet
- `GET /posts/user/:username`             — user timeline (`?limit`, `?cursor`)
- `GET /posts/user/:username/media`        — only tweets with media
- `GET /posts/user/:username/photos`       — only tweets with photos
- `GET /posts/user/:username/videos`       — only tweets with videos
- `GET /posts/user/:username/replies`      — only replies
- `GET /posts/user/:username/original`     — original tweets (no replies/RTs)
- `GET /posts/user/:username/retweets`     — only retweets
- `GET /posts/user/:username/quotes`       — only quote tweets
- `GET /posts/user/:username/text-only`    — text-only tweets
- `GET /posts/id/:tweet_id/stats`          — engagement stats
- `GET /posts/id/:tweet_id/text`           — tweet text
- `GET /posts/id/:tweet_id/hashtags`       — hashtags
- `GET /posts/id/:tweet_id/mentions`       — mentions
- `GET /posts/id/:tweet_id/urls`           — URLs
- `GET /posts/id/:tweet_id/author`         — author object
- `GET /posts/id/:tweet_id/quoted`         — quoted tweet
- `GET /posts/id/:tweet_id/conversation`   — conversation thread
- `GET /posts/ids?ids=20,21,22`            — bulk fetch by IDs
- `GET /posts/by-date?username=X&since=…&until=…`
- `GET /posts/by-language?username=X&lang=en`
- `GET /posts/by-hashtag?username=X&hashtag=ai`
- `GET /posts/popular/:username`           — sorted by likes

### Search (`/search`)
- `GET /search?q=...`                       — standard keyword search
- `GET /search/latest`, `/top`, `/advanced`
- `GET /search/photos`, `/videos`, `/news`
- `GET /search/hashtag/:hashtag`, `/cashtag/:cashtag`
- `GET /search/from/:username`, `/to/:username`, `/mention/:username`
- `GET /search/since/:date`, `/until/:date`, `/lang/:lang`
- `GET /search/min-faves/:n`, `/min-retweets/:n`
- `GET /search/near/:place`, `/verified`, `/no-retweets`, `/no-replies`, `/safe`, `/original`

### Profile (`/profile`)
- `GET /profile/:username`                  — full profile
- `GET /profile/:username/bio`, `/avatar`, `/banner`, `/display-name`,
  `/location`, `/website`, `/stats`, `/followers`, `/following`,
  `/verified`, `/protected`, `/joined`, `/id`, `/summary`, `/ratio`,
  `/influence-score`, `/avatar-hd`, `/banner-hd`, `/pinned`, `/exists`,
  `/combined`
- `GET /profile/bulk?usernames=a,b,c`

### Replies (`/replies`)
- `GET /replies/:tweet_id`, `/latest`, `/tree`, `/count`, `/by-verified`,
  `/by-author`, `/with-media`, `/with-photos`, `/popular`, `/controversial`,
  `/thread`, `/quoted`, `/context`, `/conversation-id`, `/root`

### Mentions (`/mentions`)
- `GET /mentions/:username`, `/latest`, `/top`, `/from-verified`,
  `/with-media`, `/with-photos`, `/with-videos`, `/with-links`,
  `/by-lang/:lang`, `/since/:since`, `/until/:until`,
  `/questions`, `/positive`, `/negative`, `/count`

### Trends (`/trends`)
- `GET /trends`, `/global`, `/worldwide`, `/us`, `/uk`, `/japan`,
  `/india`, `/brazil`, `/germany`, `/france`, `/canada`, `/australia`,
  `/nigeria`, `/top/:n`, `/by-volume`

### Media (`/media`)
- `GET /media/tweet/:tweet_id`, `/photos`, `/videos`, `/gifs`,
  `/first-photo`, `/first-video`, `/thumbnails`, `/count`
- `GET /media/user/:username`, `/photos`, `/videos`, `/all-photos`,
  `/all-videos`, `/avatar`, `/banner`, `/avatar-hd`, `/most-viewed`
- `GET /media/search?q=...&type=photo|video|gif|all`

### Quotes (`/quotes`)
- `GET /quotes/:tweet_id`, `/latest`, `/top`, `/by-verified`,
  `/with-media`, `/with-photos`, `/with-videos`, `/positive`, `/negative`,
  `/by-lang/:lang`, `/count`, `/since/:since`, `/until/:until`,
  `/oldest`, `/context`

## Response shape

Every tweet/profile response is wrapped in a `data` + `provider` envelope
identical to the FastAPI deployment:

```json
{
  "data": {
    "id": "20",
    "text": "just setting up my twttr",
    "author": {
      "id": "12",
      "username": "jack",
      "display_name": "jack",
      "avatar": "https://pbs.twimg.com/profile_images/...jpg",
      "verified": null
    },
    "created_at": "2006-03-21T20:50:14Z",
    "language": "en",
    "reply_count": 18089,
    "retweet_count": 124640,
    "like_count": 309872,
    "quote_count": 7308,
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
    "latency_ms": 250.35,
    "ok": true
  }
}
```

Errors use a consistent envelope:

```json
{
  "error": "provider error",
  "detail": "all providers failed (composable,syndication,nitter,rss); last error: ...",
  "provider": null
}
```

## Multi-provider router

The registry (`src/providers/index.js`) holds four provider instances and
tries each in priority order (configurable via `BLITZYXSC_PROVIDER_ORDER`):

| # | Provider | Endpoint | Strength |
|---|---|---|---|
| 1 | `composable`    | `https://api.fxtwitter.com`            | richest tweet + profile data, real UA required |
| 2 | `syndication`   | `https://cdn.syndication.twimg.com`    | Twitter's own embed CDN, no auth |
| 3 | `nitter`         | list of 8 Nitter mirrors              | RSS timelines + HTML scrape fallback |
| 4 | `rss`            | `publish.twitter.com/oembed` + Nitter | last-resort oEmbed profile stub |

The first that returns successfully wins. If a provider raises
`ProviderError`, the next is tried; only when every provider fails does the
router return a 502.

## Project structure

```
node/
├─ package.json
├─ .env.example
├─ README.md
└─ src/
   ├─ server.js                       # Express entry point (CORS + branding + routers)
   ├─ lib/
   │  ├─ config.js                    # BLITZYXSC_* env loader + branding middleware
   │  ├─ schemas.js                   # tweetResponse / profileResponse / etc.
   │  ├─ http.js                      # intQuery / strQuery / asyncHandler / errors
   │  ├─ parseFxtwitter.js            # pure fxtwitter → blitzyxsc Tweet/Profile parser
   │  └─ playground.html              # interactive playground UI
   ├─ providers/
   │  └─ index.js                     # composable + syndication + nitter + rss + registry
   └─ routes/
      ├─ meta.js                      # /, /health, /providers, /providers/health, /playground
      ├─ posts.js
      ├─ search.js
      ├─ profile.js
      ├─ replies.js
      ├─ mentions.js
      ├─ trends.js
      ├─ media.js
      └─ quotes.js
```

## Deployment

**Works on:** Railway, Render, Fly.io, Heroku, AWS ECS, GCP Cloud Run, Azure
Container Apps — any platform that runs a long-lived Node.js HTTP server.

**Does NOT work on Vercel** — Vercel is serverless-only and Express requires
a long-running server. For Vercel deployments, use the Next.js port at
[`../ts/`](../ts/) instead.

### Railway

```bash
railway init
railway up
# Railway auto-detects package.json + npm start
```

### Render

```yaml
services:
  - type: web
    name: blitzyxsc-express
    env: node
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
```

### Fly.io

```bash
fly launch          # uses the default Node.js template
fly deploy
```

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Smoke test

```bash
npm install --silent
node src/server.js &
SERVER_PID=$!
sleep 2
curl -s http://localhost:3001/health | jq
curl -s http://localhost:3001/posts/20 | jq .data.text        # "just setting up my twttr"
curl -s http://localhost:3001/profile/elonmusk | jq .data.followers
curl -sI http://localhost:3001/health | grep -i "x-powered-by\|x-author"
kill $SERVER_PID
```

## Branding

- Package: `blitzyxsc-express` v1.0.0 by **Blitz <blitzlabx>** ([@blitzlabx](https://x.com/blitzlabx))
- License: MIT
- Headers: every response carries `X-Powered-By: blitzyxsc 1.0.0` + `X-Author: blitzlabx`
- Landing page footer links to https://x.com/blitzlabx

## License

MIT © Blitz (blitzlabx) — https://x.com/blitzlabx

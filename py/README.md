# blitzyxsc — Python FastAPI edition

**Auth-free X/Twitter scraping API** by [Blitz](https://x.com/blitzlabx) (`@blitzlabx`).

This is the **primary implementation** of blitzyxsc, with all 220+ endpoints and full multi-provider fallback. Deploy on Vercel, Docker, or any Python host.

## Quick start

```bash
# Install deps
pip install -r requirements.txt

# Run locally with hot reload
uvicorn blitzyxsc_api.main:app --reload

# Or use the blitzyxsc CLI
pip install -e .
blitzyxsc --reload
```

Server starts at http://localhost:8000.

## Endpoints

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json
- **Playground**: http://localhost:8000/playground
- **Health**: http://localhost:8000/health
- **Providers**: http://localhost:8000/providers

See the parent [README](../README.md) for the full endpoint list.

## Deploy to Vercel

```bash
vercel deploy
```

The included `vercel.json` configures the build. No additional setup required.

## Deploy with Docker

```bash
docker build -t blitzyxsc .
docker run -p 8000:8000 blitzyxsc
```

## Tests

```bash
# Unit + live smoke tests
pytest tests/ -v

# Skip live tests (no network)
BLITZYXSC_SKIP_LIVE=1 pytest tests/test_unit.py -v
```

## Configuration

All settings come from env vars prefixed `BLITZYXSC_`. See `.env.example`.

## Optional: enable twscrape

For more powerful scraping (search, replies, quotes via guest accounts):

```bash
pip install twscrape
# Add guest accounts (one-time setup)
twscrape add_account user email password
twscrape run_jobs
```

Once installed and configured, the twscrape provider will automatically kick in for endpoints that composable/syndicate/nitter can't serve (search, replies, quotes).

## Optional: enable snscrape

For legacy scraping (mostly defunct post-2023 but kept as fallback):

```bash
pip install snscrape lxml beautifulsoup4
```

## Project structure

```
py/
├── blitzyxsc_api/
│   ├── __init__.py
│   ├── main.py              # FastAPI app entry point
│   ├── config.py            # Settings (pydantic-settings)
│   ├── cli.py               # blitzyxsc CLI command
│   ├── schemas/
│   │   └── models.py        # Pydantic models
│   ├── providers/
│   │   ├── __init__.py      # ProviderRegistry (multi-provider router)
│   │   ├── base.py          # BaseProvider abstract class
│   │   ├── composable.py    # fxtwitter
│   │   ├── syndication.py   # Twitter CDN
│   │   ├── nitter.py        # Nitter mirrors
│   │   ├── twscrape_provider.py
│   │   ├── snscrape_provider.py
│   │   └── rss.py           # oEmbed fallback
│   └── routers/
│       ├── posts.py         # 35 endpoints
│       ├── search.py        # 30 endpoints
│       ├── profile.py       # 30 endpoints
│       ├── replies.py       # 25 endpoints
│       ├── mentions.py      # 15 endpoints
│       ├── trends.py        # 15 endpoints
│       ├── media.py         # 20 endpoints
│       ├── quotes.py        # 15 endpoints
│       └── tweet.py         # shortcuts
├── tests/
│   ├── test_unit.py         # 8 unit tests
│   └── test_live.py         # 11 live smoke tests
├── playground.html          # Interactive playground
├── pyproject.toml
├── requirements.txt
├── Dockerfile
├── vercel.json
└── .env.example
```

## Branding

- Package name: `blitzyxsc`
- Author: `Blitz <blitzlabx>`
- License: MIT
- Response headers: `X-Powered-By: blitzyxsc 1.0.0`, `X-Author: blitzlabx`
- CLI command: `blitzyxsc`
- Docker image: `blitzyxsc`

Built by [Blitz](https://x.com/blitzlabx) — `@blitzlabx` everywhere.

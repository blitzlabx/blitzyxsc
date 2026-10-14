"""blitzyxsc — main FastAPI application entry point.

Run locally:  uvicorn blitzyxsc_api.main:app --reload
On Vercel:   configured via vercel.json → blitzyxsc_api.main:app
"""
from __future__ import annotations

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse

from . import __author__, __brand__, __version__
from .config import settings
from .providers import registry
from .routers import (
    media_router,
    mentions_router,
    posts_router,
    profile_router,
    quotes_router,
    replies_router,
    search_router,
    trends_router,
    tweet_router,
)
from .schemas.models import (
    HealthResponse,
    ProviderListResponse,
)

START_TIME = time.time()


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    # cleanup provider httpx clients
    for p in registry.providers.values():
        try:
            await p.close()
        except Exception:
            pass


app = FastAPI(
    title=f"{__brand__} — X/Twitter Free API",
    description=(
        f"""
# {__brand__}

**Auth-free X/Twitter scraping API** by {__author__}.

## Features

- 🚀 **Multi-provider router** — tries each source in priority order:
  syndication → nitter → composable (fxtwitter) → twscrape → snscrape → RSS
- 🔓 **No auth required** — uses public guest endpoints only
- 🌐 **CORS-enabled** — drop-in for any frontend
- 📊 **~200 endpoints** across 7 routers: Posts, Search, Profile, Replies, Mentions, Trends, Media, Quotes
- 🔄 **Auto-fallback** — if one source is rate-limited or down, the next picks up
- 📚 **Interactive docs** at `/docs` (Swagger) and `/redoc`
- 🐳 **Vercel-ready** — deploy as a serverless function in seconds

## Quick Start

```bash
# Run locally
pip install -r requirements.txt
uvicorn blitzyxsc_api.main:app --reload

# or run on Vercel
vercel deploy
```

## Endpoints Overview

| Router | Prefix | Endpoints |
|--------|--------|-----------|
| Posts & Timeline | `/posts` | 35 |
| Search | `/search` | 30 |
| Profile | `/profile` | 30 |
| Replies & Comments | `/replies` | 25 |
| Mentions | `/mentions` | 15 |
| Trends | `/trends` | 15 |
| Media | `/media` | 20 |
| Quotes | `/quotes` | 15 |
| Tweet Shortcuts | `/tweet` | 35 |

## Branding

**{__brand__}** by {__author__} — uses public endpoints only, no risk of account ban.
        """
    ),
    version=__version__,
    author=__author__,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    license_info={"name": "MIT", "url": "https://opensource.org/license/mit"},
    lifespan=lifespan,
)

# CORS — wide open for dev / frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_branding_headers(request: Request, call_next):
    """Add blitzyxsc branding headers to every response."""
    response = await call_next(request)
    response.headers["X-Powered-By"] = f"{__brand__} {__version__}"
    response.headers["X-Author"] = "blitzlabx"
    return response


# ---- root / health / meta -----------------------------------------------

@app.get("/", response_class=HTMLResponse, include_in_schema=False)
async def root():
    """Landing page — links to docs."""
    return HTMLResponse(
        f"""
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>{__brand__}</title>
<style>
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0a0a0a; color: #fff; }}
.container {{ max-width: 800px; margin: 0 auto; padding: 80px 24px; text-align: center; }}
h1 {{ font-size: 64px; margin: 0 0 12px; background: linear-gradient(90deg, #1DA1F2, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }}
.tagline {{ font-size: 20px; color: #aaa; margin-bottom: 32px; }}
.btn {{ display: inline-block; padding: 12px 24px; background: #1DA1F2; color: #fff; text-decoration: none; border-radius: 8px; margin: 4px; font-weight: 600; }}
.btn.secondary {{ background: transparent; border: 1px solid #333; }}
.meta {{ margin-top: 60px; color: #666; font-size: 14px; }}
.meta a {{ color: #1DA1F2; }}
</style>
</head>
<body>
<div class="container">
<h1>{__brand__}</h1>
<p class="tagline">Auth-free X/Twitter scraping API</p>
<a href="/docs" class="btn">Swagger UI</a>
<a href="/redoc" class="btn secondary">ReDoc</a>
<a href="/openapi.json" class="btn secondary">OpenAPI Spec</a>
<a href="/playground" class="btn secondary">Playground</a>
<p class="meta">
v{__version__} • by <a href="https://x.com/blitzlabx" target="_blank">@blitzlabx</a> •
Powered by public guest endpoints • No auth required
</p>
</div>
</body>
</html>
        """
    )


@app.get(
    "/health",
    response_model=HealthResponse,
    tags=["Meta"],
    summary="Health check + provider status",
)
async def health():
    return HealthResponse(
        status="ok",
        brand=__brand__,
        version=__version__,
        author=__author__,
        providers=list(registry.providers.keys()),
        uptime_seconds=time.time() - START_TIME,
    )


@app.get(
    "/providers",
    response_model=ProviderListResponse,
    tags=["Meta"],
    summary="List configured providers and their priority order",
)
async def list_providers():
    return ProviderListResponse(
        providers=registry.list(),
        order=settings.provider_order,
    )


@app.get(
    "/providers/health",
    tags=["Meta"],
    summary="Check health of each provider (live probe)",
)
async def check_providers():
    import asyncio
    results = {}
    for name, p in registry.providers.items():
        try:
            ok = await p.health()
            results[name] = {"healthy": ok}
        except Exception as e:
            results[name] = {"healthy": False, "error": str(e)}
    return results


@app.get(
    "/playground",
    response_class=HTMLResponse,
    include_in_schema=False,
    tags=["Meta"],
)
async def playground():
    """Interactive playground HTML page."""
    try:
        with open("playground.html", "r") as f:
            return HTMLResponse(f.read())
    except FileNotFoundError:
        try:
            with open("static/playground.html") as f:
                return HTMLResponse(f.read())
        except FileNotFoundError:
            return HTMLResponse("<h1>Playground file not found</h1>")


# ---- register routers ----------------------------------------------------

app.include_router(posts_router)
app.include_router(search_router)
app.include_router(profile_router)
app.include_router(replies_router)
app.include_router(mentions_router)
app.include_router(trends_router)
app.include_router(media_router)
app.include_router(quotes_router)
app.include_router(tweet_router)

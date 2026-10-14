"""blitzyxsc configuration. All settings come from env vars (no auth required)."""
from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BLITZYXSC_", env_file=".env", extra="ignore"
    )

    # Branding
    brand: str = "blitzyxsc"
    author: str = "Blitz (blitzlabx)"

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: List[str] = Field(default_factory=lambda: ["*"])

    # Provider priority order (first that succeeds wins)
    provider_order: List[str] = Field(
        default_factory=lambda: [
            "composable",
            "syndication",
            "nitter",
            "twscrape",
            "snscrape",
            "rss",
        ]
    )

    # Per-provider timeouts (seconds)
    syndication_timeout: float = 10.0
    nitter_timeout: float = 15.0
    twscrape_timeout: float = 30.0
    snscrape_timeout: float = 30.0
    composable_timeout: float = 15.0
    rss_timeout: float = 15.0

    # Nitter instances — tried in order
    nitter_instances: List[str] = Field(
        default_factory=lambda: [
            "https://nitter.meowing.monster",
            "https://nitter.poast.org",
            "https://nitter.privacydev.net",
            "https://nitter.cz",
            "https://nitter.woodland.cafe",
            "https://nitter.1d4.us",
            "https://nitter.kavin.rocks",
            "https://nitter.unixfox.eu",
        ]
    )

    # Composable X graphql endpoint
    composable_base_url: str = "https://api.fxtwitter.com"

    # Syndication endpoint (Twitter's own guest embed API — no auth needed for embeds)
    syndication_base_url: str = "https://cdn.syndication.twimg.com"
    syndication_timeline_url: str = "https://cdn.syndication.twimg.com/timeline/profile"

    # Caching
    cache_ttl_seconds: int = 60

    # Default page sizes
    default_page_size: int = 20
    max_page_size: int = 100

    # User agent
    user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()

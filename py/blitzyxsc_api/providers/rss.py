"""RSS/REST provider — last-resort fallback using RSS feeds and direct REST.

Uses public RSS endpoints (nitter-style) and direct x.com oEmbed requests.
"""
from __future__ import annotations

from typing import List, Optional

import httpx

from ..config import settings
from ..schemas.models import MediaItem, Profile, Trend, Tweet, TweetAuthor
from .nitter import NitterProvider
from .base import BaseProvider, ProviderError


class RSSProvider(BaseProvider):
    name = "rss"
    timeout = settings.rss_timeout

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        super().__init__(client)
        # delegate to a Nitter provider for RSS-style endpoints
        self._nitter = NitterProvider(client)

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        # x.com no longer serves RSS directly; use Nitter RSS
        return await self._nitter.get_user_tweets(username, limit=limit, cursor=cursor)

    async def get_profile(self, username: str) -> Profile:
        # try x.com oEmbed (works without auth, returns minimal info)
        c = await self.client()
        try:
            r = await c.get(
                "https://publish.twitter.com/oembed",
                params={"url": f"https://x.com/{username}"},
            )
            if r.status_code == 200:
                data = r.json()
                # oEmbed returns author_name + html snippet
                return Profile(
                    username=username,
                    display_name=data.get("author_name", username),
                )
        except httpx.HTTPError:
            pass
        # fall through to Nitter
        return await self._nitter.get_profile(username)

    async def get_mentions(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        return await self._nitter.get_mentions(username, limit=limit, cursor=cursor)

    async def search_tweets(
        self, query: str, limit: int = 20, cursor: Optional[str] = None,
        sort: str = "latest", filters: Optional[dict] = None
    ) -> List[Tweet]:
        return await self._nitter.search_tweets(query, limit=limit, cursor=cursor, sort=sort, filters=filters)

    async def health(self) -> bool:
        return await self._nitter.health()

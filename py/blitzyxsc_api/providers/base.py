"""Base provider interface — every source implements this contract."""
from __future__ import annotations

import abc
import time
from typing import List, Optional

import httpx

from ..config import settings
from ..schemas.models import (
    Profile,
    ProviderInfo,
    Trend,
    Tweet,
)


class ProviderError(Exception):
    """Raised when a provider cannot fulfill a request."""


class BaseProvider(abc.ABC):
    """Abstract base — subclasses implement specific source accessors."""

    name: str = "base"

    def __init__(self, client: Optional[httpx.AsyncClient] = None):
        # NOTE: We deliberately do NOT cache the client across requests,
        # because httpx.AsyncClient binds to a specific event loop and
        # TestClient/serverless reuse breaks this. Each call creates a fresh
        # client. (httpx pool startup is cheap.)
        self._client = None
        self.timeout: float = 15.0

    async def client(self) -> httpx.AsyncClient:
        # Always create a fresh client. Subclasses that need custom headers
        # should override this method.
        return httpx.AsyncClient(
            timeout=self.timeout,
            headers={"User-Agent": settings.user_agent},
            follow_redirects=True,
        )

    async def close(self) -> None:
        # No-op: clients are created per-call and not cached.
        pass

    # ----- helpers ----------------------------------------------------------

    def info(self, ok: bool = True, latency_ms: Optional[float] = None) -> ProviderInfo:
        return ProviderInfo(name=self.name, ok=ok, latency_ms=latency_ms)

    async def _timed(self, fn, *args, **kwargs):
        start = time.perf_counter()
        try:
            result = await fn(*args, **kwargs)
            latency = (time.perf_counter() - start) * 1000.0
            return result, latency
        except Exception:
            latency = (time.perf_counter() - start) * 1000.0
            raise ProviderError(f"{self.name} failed after {latency:.1f}ms")

    # ----- provider interface (each raises ProviderError if unsupported) --

    async def get_tweet(self, tweet_id: str) -> Tweet:
        raise ProviderError(f"{self.name} does not support get_tweet")

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        raise ProviderError(f"{self.name} does not support get_user_tweets")

    async def get_profile(self, username: str) -> Profile:
        raise ProviderError(f"{self.name} does not support get_profile")

    async def search_tweets(
        self,
        query: str,
        limit: int = 20,
        cursor: Optional[str] = None,
        sort: str = "latest",
        filters: Optional[dict] = None,
    ) -> List[Tweet]:
        raise ProviderError(f"{self.name} does not support search_tweets")

    async def get_replies(
        self, tweet_id: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        raise ProviderError(f"{self.name} does not support get_replies")

    async def get_quotes(
        self, tweet_id: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        raise ProviderError(f"{self.name} does not support get_quotes")

    async def get_mentions(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        # default implementation: search "to:username" or "@username"
        return await self.search_tweets(f"@{username}", limit=limit, cursor=cursor)

    async def get_trends(
        self, woeid: Optional[int] = None, location: Optional[str] = None
    ) -> List[Trend]:
        raise ProviderError(f"{self.name} does not support get_trends")

    async def get_media(
        self, identifier: str, by: str = "tweet", media_type: Optional[str] = None
    ) -> List:
        raise ProviderError(f"{self.name} does not support get_media")

    async def health(self) -> bool:
        """Return True if provider is reachable. Subclasses can override."""
        return True

"""Provider registry + multi-source router.

The router tries each provider in priority order (configurable via env)
and returns the first successful response, falling back gracefully.
"""
from __future__ import annotations

import time
from typing import Callable, List, Optional

from ..config import settings
from ..schemas.models import ProviderInfo
from .base import BaseProvider, ProviderError
from .composable import ComposableProvider
from .nitter import NitterProvider
from .rss import RSSProvider
from .snscrape_provider import SnscrapeProvider
from .syndication import SyndicationProvider
from .twscrape_provider import TwscrapeProvider


class ProviderRegistry:
    """Holds provider instances and routes calls with fallback."""

    def __init__(self):
        self.providers: dict[str, BaseProvider] = {
            "syndication": SyndicationProvider(),
            "nitter": NitterProvider(),
            "composable": ComposableProvider(),
            "twscrape": TwscrapeProvider(),
            "snscrape": SnscrapeProvider(),
            "rss": RSSProvider(),
        }

    def list(self) -> List[dict]:
        return [
            {"name": name, "priority": i + 1}
            for i, name in enumerate(settings.provider_order)
            if name in self.providers
        ]

    async def call_with_fallback(self, method_name: str, *args, **kwargs):
        """Try each provider in priority order; return (result, provider_info).

        Raises the last error if every provider fails.
        """
        last_err: Optional[Exception] = None
        tried: List[str] = []
        for pname in settings.provider_order:
            provider = self.providers.get(pname)
            if provider is None:
                continue
            tried.append(pname)
            method: Callable = getattr(provider, method_name, None)
            if method is None:
                continue
            start = time.perf_counter()
            try:
                result = await method(*args, **kwargs)
                latency_ms = (time.perf_counter() - start) * 1000.0
                return result, ProviderInfo(name=pname, ok=True, latency_ms=latency_ms)
            except ProviderError as e:
                last_err = e
                continue
            except Exception as e:
                last_err = ProviderError(f"{pname} unexpected error: {e}")
                continue
        # all providers failed
        raise ProviderError(
            f"all providers failed ({','.join(tried)}); last error: {last_err}"
        )


registry = ProviderRegistry()

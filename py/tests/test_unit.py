"""Unit tests for blitzyxsc schemas and provider routing logic (no network)."""
from __future__ import annotations

import pytest

from blitzyxsc_api.schemas.models import (
    MediaItem,
    Profile,
    ProviderInfo,
    Tweet,
    TweetAuthor,
)
from blitzyxsc_api.providers.base import BaseProvider, ProviderError
from blitzyxsc_api.config import settings


class _DummyOKProvider(BaseProvider):
    name = "dummy_ok"

    async def get_tweet(self, tweet_id: str) -> Tweet:
        return Tweet(id=tweet_id, text="hello", author=TweetAuthor(username="alice"))


class _DummyFailProvider(BaseProvider):
    name = "dummy_fail"

    async def get_tweet(self, tweet_id: str) -> Tweet:
        raise ProviderError(f"dummy_fail failed for {tweet_id}")


def test_tweet_schema_roundtrip():
    t = Tweet(
        id="123",
        text="hello world #test",
        author=TweetAuthor(username="alice", display_name="Alice"),
        media=[MediaItem(type="photo", url="https://example.com/photo.jpg")],
        hashtags=["test"],
    )
    data = t.model_dump()
    assert data["id"] == "123"
    assert data["hashtags"] == ["test"]
    assert data["media"][0]["type"] == "photo"


def test_profile_schema_defaults():
    p = Profile(username="alice")
    assert p.username == "alice"
    assert p.followers is None
    assert p.verified is None


def test_provider_info_model():
    info = ProviderInfo(name="syndication", ok=True, latency_ms=42.5)
    assert info.name == "syndication"
    assert info.ok is True
    assert info.latency_ms == 42.5


def test_settings_defaults():
    assert settings.brand == "blitzyxsc"
    assert settings.author == "Blitz (blitzlabx)"
    assert "syndication" in settings.provider_order
    assert "nitter" in settings.provider_order


def test_dummy_provider_returns_tweet():
    import asyncio
    p = _DummyOKProvider()
    t = asyncio.get_event_loop().run_until_complete(p.get_tweet("999"))
    assert t.id == "999"
    assert t.text == "hello"


def test_dummy_provider_raises_provider_error():
    import asyncio
    p = _DummyFailProvider()
    with pytest.raises(ProviderError):
        asyncio.get_event_loop().run_until_complete(p.get_tweet("999"))


def test_provider_fallback_picks_first_success():
    """If provider A fails and B succeeds, the registry should return B."""
    import asyncio
    from blitzyxsc_api.providers import ProviderRegistry

    reg = ProviderRegistry()
    # monkeypatch the providers
    reg.providers = {
        "fail1": _DummyFailProvider(),
        "ok1": _DummyOKProvider(),
        "fail2": _DummyFailProvider(),
    }
    settings.provider_order = ["fail1", "ok1", "fail2"]
    tweet, info = asyncio.get_event_loop().run_until_complete(
        reg.call_with_fallback("get_tweet", "123")
    )
    assert tweet.id == "123"
    assert info.name == "ok1"


def test_provider_fallback_raises_when_all_fail():
    import asyncio
    from blitzyxsc_api.providers import ProviderRegistry

    reg = ProviderRegistry()
    reg.providers = {
        "fail1": _DummyFailProvider(),
        "fail2": _DummyFailProvider(),
    }
    settings.provider_order = ["fail1", "fail2"]
    with pytest.raises(ProviderError):
        asyncio.get_event_loop().run_until_complete(
            reg.call_with_fallback("get_tweet", "123")
        )

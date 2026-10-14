"""Composable X / fxtwitter provider — uses the public fxtwitter API.

fxtwitter exposes a clean JSON API for tweets and profiles without auth.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

import httpx

from ..config import settings
from ..schemas.models import MediaItem, Profile, Trend, Tweet, TweetAuthor
from .base import BaseProvider, ProviderError


def _parse_twitter_date(s: Optional[str]) -> Optional[datetime]:
    """Parse Twitter-style date strings: 'Tue Mar 21 20:50:14 +0000 2006'."""
    if not s:
        return None
    for fmt in (
        "%a %b %d %H:%M:%S %z %Y",
        "%a %b %d %H:%M:%S %Y",
        "%Y-%m-%dT%H:%M:%S.%fZ",
        "%Y-%m-%dT%H:%M:%SZ",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ):
        try:
            dt = datetime.strptime(s, fmt)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            continue
    return None


class ComposableProvider(BaseProvider):
    name = "composable"
    timeout = settings.composable_timeout
    base_url = "https://api.fxtwitter.com"

    async def client(self) -> httpx.AsyncClient:
        # fxtwitter requires a real UA or returns 403.
        # Always create a fresh client to avoid event-loop binding issues.
        return httpx.AsyncClient(
            timeout=self.timeout,
            headers={
                "User-Agent": settings.user_agent,
                "Accept": "application/json",
                "Accept-Language": "en-US,en;q=0.9",
            },
            follow_redirects=True,
        )

    async def get_tweet(self, tweet_id: str) -> Tweet:
        c = await self.client()
        try:
            r = await c.get(f"{self.base_url}/status/{tweet_id}")
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ProviderError(f"composable tweet {tweet_id}: {e}") from e
        data = r.json()
        if not data or "tweet" not in data:
            raise ProviderError(f"composable tweet {tweet_id}: empty")
        return self._parse_tweet(data["tweet"])

    async def get_profile(self, username: str) -> Profile:
        c = await self.client()
        try:
            r = await c.get(f"{self.base_url}/{username}")
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ProviderError(f"composable profile {username}: {e}") from e
        data = r.json()
        u = data.get("user", {})
        if not u:
            raise ProviderError(f"composable profile {username}: empty")
        # fxtwitter uses 'followers'/'following'/'tweets'/'likes' (no _count suffix)
        verification = u.get("verification") or {}
        return Profile(
            id=str(u.get("id", "")),
            username=u.get("screen_name", username),
            display_name=u.get("name"),
            bio=u.get("description"),
            location=u.get("location"),
            website=u.get("website") or u.get("url"),
            avatar=u.get("avatar_url"),
            banner=u.get("banner_url"),
            followers=u.get("followers"),
            following=u.get("following"),
            tweets_count=u.get("tweets"),
            likes_count=u.get("likes"),
            listed_count=None,
            verified=verification.get("verified") if isinstance(verification, dict) else verification,
            protected=u.get("protected"),
        )

    def _parse_tweet(self, t: dict) -> Tweet:
        # fxtwitter uses 'author' for tweets, 'user' for profiles
        user_data = t.get("author") or t.get("user") or {}
        author = TweetAuthor(
            id=str(user_data.get("id", "")),
            username=user_data.get("screen_name") or user_data.get("username", ""),
            display_name=user_data.get("name"),
            avatar=user_data.get("profile_image_url") or user_data.get("avatar_url"),
            verified=user_data.get("verified"),
        )
        media: List[MediaItem] = []
        all_media = t.get("media", {}).get("all", []) if isinstance(t.get("media"), dict) else (t.get("media") or [])
        for m in all_media:
            media.append(
                MediaItem(
                    type=m.get("type", "photo"),
                    url=m.get("url", ""),
                    alt=m.get("altText"),
                    width=m.get("width"),
                    height=m.get("height"),
                    thumbnail=m.get("thumbnail_url"),
                    duration_ms=m.get("duration"),
                )
            )
        return Tweet(
            id=str(t.get("id", "")),
            text=t.get("text", ""),
            author=author,
            language=t.get("lang"),
            reply_count=t.get("replies"),
            retweet_count=t.get("retweets"),
            like_count=t.get("likes"),
            quote_count=t.get("quotes"),
            view_count=t.get("views"),
            media=media,
            urls=[u.get("url") for u in t.get("urls", [])],
            hashtags=[h for h in t.get("hashtags", [])],
            mentions=[TweetAuthor(username=m.get("screen_name") or m.get("name")) for m in t.get("mentions", [])],
            is_quote=bool(t.get("quote")),
            quoted_tweet=self._parse_tweet(t["quote"]) if t.get("quote") else None,
            url=t.get("url"),
            sensitive=t.get("possibly_sensitive"),
            created_at=_parse_twitter_date(t.get("created_at")),
        )

    async def health(self) -> bool:
        try:
            c = await self.client()
            r = await c.get(self.base_url, timeout=5)
            return r.status_code < 500
        except Exception:
            return False

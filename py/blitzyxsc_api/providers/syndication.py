"""Twitter syndication provider — uses Twitter's public embed CDN.

No auth required. CDN serves tweet embeds + user timelines as JSON.
Endpoints discovered from public reverse-engineering.
"""
from __future__ import annotations

import json
from typing import List, Optional

import httpx

from ..config import settings
from ..schemas.models import MediaItem, Trend, Tweet, TweetAuthor
from .base import BaseProvider, ProviderError


class SyndicationProvider(BaseProvider):
    name = "syndication"
    timeout = settings.syndication_timeout

    async def get_tweet(self, tweet_id: str) -> Tweet:
        c = await self.client()
        # syndication tweet endpoint returns tweet + user as embed JSON
        url = f"{settings.syndication_base_url}/tweet-result?id={tweet_id}&token=0"
        try:
            r = await c.get(url)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ProviderError(f"syndication tweet {tweet_id}: {e}") from e
        raw = r.json()
        if not raw:
            raise ProviderError(f"syndication tweet {tweet_id}: empty response")
        return self._parse_tweet(raw)

    # NOTE: get_profile is intentionally not implemented here. fxtwitter
    # (composable provider) returns richer profile data with the same UA.
    # The router falls through to composable automatically.

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        # syndication timeline/profile endpoint serves recent tweets of a user
        c = await self.client()
        params = {
            "screen_name": username,
            "count": str(limit),
            "lang": "en",
        }
        if cursor:
            params["cursor"] = cursor
        try:
            r = await c.get(settings.syndication_timeline_url, params=params)
            r.raise_for_status()
        except httpx.HTTPError as e:
            raise ProviderError(f"syndication timeline {username}: {e}") from e
        text = r.text
        # syndication timeline returns a "tweet-body" HTML stream, try JSON first
        try:
            data = r.json()
        except json.JSONDecodeError:
            data = self._parse_html_timeline(text)
        if not data:
            raise ProviderError(f"syndication timeline {username}: empty")
        tweets_data = data.get("tweets", []) if isinstance(data, dict) else data
        return [self._parse_tweet(t) for t in tweets_data[:limit]]

    def _parse_html_timeline(self, html: str) -> list:
        """Best-effort parse of syndication timeline HTML; return [] if it fails."""
        if not html:
            return []
        # syndication timeline is HTML; for now we yield no tweets and let other
        # providers fill in. A more robust parser could be added later.
        return []

    def _parse_tweet(self, raw: dict) -> Tweet:
        user_raw = raw.get("user", {})
        author = TweetAuthor(
            id=str(user_raw.get("id_str", user_raw.get("id", ""))),
            username=user_raw.get("screen_name", ""),
            display_name=user_raw.get("name"),
            avatar=user_raw.get("profile_image_url_https"),
            verified=user_raw.get("verified"),
        )

        media: List[MediaItem] = []
        for m in raw.get("mediaDetails", raw.get("extended_entities", {}).get("media", [])):
            media.append(
                MediaItem(
                    type=m.get("type", "photo"),
                    url=m.get("media_url_https") or m.get("media_url", ""),
                    alt=m.get("altText") or m.get("display_url"),
                    width=m.get("original_info", {}).get("width"),
                    height=m.get("original_info", {}).get("height"),
                    thumbnail=m.get("media_url_https"),
                    duration_ms=m.get("duration_millis"),
                )
            )

        urls = [u.get("expanded_url", u.get("url")) for u in raw.get("entities", {}).get("urls", [])]
        hashtags = [h.get("text") for h in raw.get("entities", {}).get("hashtags", [])]
        mentions = [
            TweetAuthor(username=m.get("screen_name"), id=str(m.get("id_str", "")))
            for m in raw.get("entities", {}).get("user_mentions", [])
        ]
        cashtags = [c.get("text") for c in raw.get("entities", {}).get("symbols", [])]

        quoted = None
        if raw.get("quoted_status_id_str") or raw.get("quoted_status"):
            q = raw.get("quoted_status", {}) or {}
            if q:
                quoted = self._parse_tweet(q)

        return Tweet(
            id=str(raw.get("id_str", raw.get("id", ""))),
            text=raw.get("text", raw.get("full_text", "")),
            author=author,
            language=raw.get("lang"),
            source=raw.get("source"),
            reply_count=raw.get("reply_count"),
            retweet_count=raw.get("retweet_count"),
            like_count=raw.get("favorite_count"),
            quote_count=raw.get("quote_count"),
            bookmark_count=raw.get("bookmark_count"),
            view_count=raw.get("view_count"),
            media=media,
            urls=urls,
            hashtags=hashtags,
            mentions=mentions,
            cashtags=cashtags,
            conversation_id=str(raw["conversation_id_str"]) if raw.get("conversation_id_str") else None,
            in_reply_to=str(raw["in_reply_to_status_id_str"]) if raw.get("in_reply_to_status_id_str") else None,
            is_quote=bool(quoted),
            quoted_tweet=quoted,
            url=f"https://x.com/{author.username}/status/{raw.get('id_str', raw.get('id'))}",
            sensitive=raw.get("possibly_sensitive"),
        )

    async def health(self) -> bool:
        try:
            c = await self.client()
            r = await c.get(f"{settings.syndication_base_url}/", timeout=5)
            return r.status_code < 500
        except Exception:
            return False

"""snscrape provider — uses snscrape library if installed.

snscrape is mostly defunct post-2023 but still works for some endpoints
via legacy code paths. Optional — raises ProviderError if not installed.
"""
from __future__ import annotations

import asyncio
import json
from typing import List, Optional

from ..config import settings
from ..schemas.models import MediaItem, Profile, Trend, Tweet, TweetAuthor
from .base import BaseProvider, ProviderError


class SnscrapeProvider(BaseProvider):
    name = "snscrape"
    timeout = settings.snscrape_timeout

    async def _run(self, *args: str) -> str:
        try:
            proc = await asyncio.create_subprocess_exec(
                "snscrape", *args,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
        except FileNotFoundError as e:
            raise ProviderError("snscrape binary not installed") from e
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise ProviderError(f"snscrape failed: {stderr.decode()[:200]}")
        return stdout.decode(errors="ignore")

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        out = await self._run("--jsonl", "--max-results", str(limit), "twitter-user", username)
        return [self._parse_line(line) for line in out.splitlines() if line][:limit]

    async def search_tweets(
        self, query: str, limit: int = 20, cursor: Optional[str] = None,
        sort: str = "latest", filters: Optional[dict] = None
    ) -> List[Tweet]:
        out = await self._run("--jsonl", "--max-results", str(limit), "twitter-search", query)
        return [self._parse_line(line) for line in out.splitlines() if line][:limit]

    def _parse_line(self, line: str) -> Tweet:
        d = json.loads(line)
        user = d.get("user", {})
        media = []
        for m in d.get("media", []) or []:
            if m.get("_type") == "snscrape.modules.twitter.Photo":
                media.append(MediaItem(type="photo", url=m.get("url", "")))
            elif m.get("_type") == "snscrape.modules.twitter.Video":
                v = (m.get("variants") or [{}])[-1]
                media.append(MediaItem(type="video", url=v.get("url", ""), duration_ms=m.get("duration")))
        return Tweet(
            id=str(d.get("id", "")),
            text=d.get("rawContent", d.get("content", "")),
            author=TweetAuthor(
                id=str(user.get("id", "")),
                username=user.get("username", ""),
                display_name=user.get("displayname"),
                verified=user.get("verified"),
            ),
            language=d.get("lang"),
            reply_count=d.get("replyCount"),
            retweet_count=d.get("retweetCount"),
            like_count=d.get("likeCount"),
            quote_count=d.get("quoteCount"),
            view_count=d.get("viewCount"),
            media=media,
            hashtags=[h for h in d.get("hashtags", []) or []],
            mentions=[TweetAuthor(username=u.get("username")) for u in d.get("mentionedUsers", []) or []],
            conversation_id=str(d.get("conversationId")) if d.get("conversationId") else None,
            in_reply_to=str(d.get("inReplyToTweetId")) if d.get("inReplyToTweetId") else None,
            url=d.get("url"),
        )

    async def health(self) -> bool:
        try:
            proc = await asyncio.create_subprocess_exec(
                "snscrape", "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            await proc.communicate()
            return proc.returncode == 0
        except FileNotFoundError:
            return False

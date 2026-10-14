"""Nitter provider — public Nitter mirrors serve RSS/JSON/HTML for free.

Tries a list of Nitter instances in order; first that responds wins.
"""
from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone
from typing import List, Optional
from xml.etree import ElementTree as ET

import httpx

from ..config import settings
from ..schemas.models import MediaItem, Profile, Trend, Tweet, TweetAuthor
from .base import BaseProvider, ProviderError


class NitterProvider(BaseProvider):
    name = "nitter"
    timeout = settings.nitter_timeout

    async def _try_instances(self, path: str) -> tuple[httpx.Response, str]:
        """Try every Nitter instance; return (response, base_url)."""
        c = await self.client()
        last_err = None
        for base in settings.nitter_instances:
            url = f"{base}{path}"
            try:
                r = await c.get(url)
                if r.status_code == 200 and r.text:
                    return r, base
            except httpx.HTTPError as e:
                last_err = e
                continue
        raise ProviderError(f"all Nitter instances failed for {path}: {last_err}")

    async def get_profile(self, username: str) -> Profile:
        try:
            r, base = await self._try_instances(f"/{username}")
        except ProviderError:
            # try RSS
            r, base = await self._try_instances(f"/{username}/rss")
        html = r.text
        # crude HTML parse — Nitter's profile card contains stats
        avatar = self._extract_first(html, r'data-src="([^"]+)"') or self._extract_first(html, r'<img src="([^"]+avatar[^"]+)"')
        banner = self._extract_first(html, r'profile-banner[^"]*"([^"]+)"') or self._extract_first(html, r'cover[^"]+src="([^"]+)"')
        display_name = self._extract_first(html, r'class="profile-card-fullname"[^>]*>([^<]+)<')
        bio = self._extract_first(html, r'class="profile-bio"[^>]*>([^<]+)<')
        location = self._extract_first(html, r'class="profile-location"[^>]*>([^<]+)<')
        website = self._extract_first(html, r'class="profile-website"[^>]*>.*?href="([^"]+)"')
        followers = self._extract_int_first(html, r'"followers"[^>]*>([0-9,.]+)')
        following = self._extract_int_first(html, r'"following"[^>]*>([0-9,.]+)')
        tweets_count = self._extract_int_first(html, r'"statuses"[^>]*>([0-9,.]+)')
        return Profile(
            username=username,
            display_name=display_name,
            bio=bio,
            location=location,
            website=website,
            avatar=avatar,
            banner=banner,
            followers=followers,
            following=following,
            tweets_count=tweets_count,
        )

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        try:
            r, base = await self._try_instances(f"/{username}/rss")
        except ProviderError as e:
            raise ProviderError(f"nitter timeline {username}: {e}") from e
        tweets = self._parse_rss_feed(r.text, base=base, default_username=username)
        return tweets[:limit]

    async def search_tweets(
        self,
        query: str,
        limit: int = 20,
        cursor: Optional[str] = None,
        sort: str = "latest",
        filters: Optional[dict] = None,
    ) -> List[Tweet]:
        # Nitter search uses /search?f=tweets&q=<query>
        q = self._build_search_url(query, filters, sort)
        try:
            r, base = await self._try_instances(f"/search?f=tweets&q={q}")
        except ProviderError as e:
            raise ProviderError(f"nitter search {query}: {e}") from e
        # parse the HTML search results page
        tweets = self._parse_html_tweets(r.text, base=base)
        return tweets[:limit]

    async def get_replies(
        self, tweet_id: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        # Nitter shows conversation thread at /i/status/<id>
        try:
            r, base = await self._try_instances(f"/i/status/{tweet_id}")
        except ProviderError as e:
            raise ProviderError(f"nitter replies {tweet_id}: {e}") from e
        html = r.text
        # replies are in <div class="timeline-item"> after the main tweet
        items = self._parse_html_tweets(html, base=base, skip_first=True)
        return items[:limit]

    async def get_mentions(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        return await self.search_tweets(f"@{username}", limit=limit, cursor=cursor)

    async def get_trends(
        self, woeid: Optional[int] = None, location: Optional[str] = None
    ) -> List[Trend]:
        try:
            r, base = await self._try_instances("/trends")
        except ProviderError as e:
            raise ProviderError(f"nitter trends: {e}") from e
        html = r.text
        # parse trend links
        trends = []
        for match in re.finditer(r'class="trend-item"[^>]*>.*?href="/search\?q=([^"]+)"[^>]*>.*?<[^>]+>([^<]+)<', html, re.DOTALL):
            query, name = match.group(1), match.group(2)
            trends.append(
                Trend(
                    name=name.strip(),
                    query=query,
                    url=f"{base}/search?q={query}",
                    rank=len(trends) + 1,
                )
            )
        return trends

    # ----- parsers ---------------------------------------------------------

    def _parse_rss_feed(self, xml_text: str, base: str, default_username: str = "") -> List[Tweet]:
        try:
            root = ET.fromstring(xml_text)
        except ET.ParseError:
            return []
        ns = {"atom": "http://www.w3.org/2005/Atom"}
        items = root.findall(".//item") or root.findall(".//atom:entry", ns)
        tweets: List[Tweet] = []
        for item in items:
            title = (item.findtext("title") or item.findtext("atom:title", default="", namespaces=ns)).strip()
            link = (item.findtext("link") or "").strip()
            pub = (item.findtext("pubDate") or item.findtext("atom:published", default="", namespaces=ns)).strip()
            desc = (item.findtext("description") or item.findtext("atom:summary", default="", namespaces=ns)).strip()
            text = title
            # title is often "<author>: <text>"
            if ": " in title:
                author_part, text = title.split(": ", 1)
            else:
                author_part = default_username
            # find tweet id from link
            tid = ""
            m = re.search(r"/status/(\d+)", link)
            if m:
                tid = m.group(1)
            created_at = None
            for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%Y-%m-%dT%H:%M:%SZ"):
                try:
                    created_at = datetime.strptime(pub, fmt).replace(tzinfo=timezone.utc)
                    break
                except ValueError:
                    pass
            # extract images from description
            media = []
            for img in re.finditer(r'<img[^>]+src="([^"]+)"', desc):
                media.append(MediaItem(type="photo", url=img.group(1)))
            tweets.append(
                Tweet(
                    id=tid,
                    text=re.sub(r"<[^>]+>", "", desc).strip() or text,
                    author=TweetAuthor(username=author_part),
                    created_at=created_at,
                    media=media,
                    url=link,
                    hashtags=re.findall(r"#(\w+)", text),
                    mentions=[
                        TweetAuthor(username=m)
                        for m in re.findall(r"@(\w+)", text)
                    ],
                )
            )
        return tweets

    def _parse_html_tweets(self, html: str, base: str, skip_first: bool = False) -> List[Tweet]:
        tweets = []
        blocks = re.findall(
            r'<div class="timeline-item[^"]*"[^>]*>(.*?)<div class="timeline-item',
            html + '<div class="timeline-item',
            re.DOTALL,
        )
        if skip_first and blocks:
            blocks = blocks[1:]
        for blk in blocks:
            tid_m = re.search(r'/status/(\d+)', blk)
            tid = tid_m.group(1) if tid_m else ""
            user_m = re.search(r'href="/([^/]+)"[^>]*>@', blk) or re.search(r'username="([^"]+)"', blk)
            username = user_m.group(1) if user_m else ""
            text_m = re.search(r'class="tweet-content[^"]*"[^>]*>(.*?)</div>', blk, re.DOTALL)
            text = re.sub(r"<[^>]+>", "", text_m.group(1)).strip() if text_m else ""
            media = []
            for img in re.finditer(r'data-src="([^"]+)"|src="([^"]+\.(:?jpg|png|webp)[^"]*)"', blk):
                url = img.group(1) or img.group(2)
                if url:
                    media.append(MediaItem(type="photo", url=url))
            tweets.append(
                Tweet(
                    id=tid,
                    text=text,
                    author=TweetAuthor(username=username),
                    media=media,
                    hashtags=re.findall(r"#(\w+)", text),
                    mentions=[TweetAuthor(username=m) for m in re.findall(r"@(\w+)", text)],
                )
            )
        return tweets

    def _build_search_url(self, query: str, filters: Optional[dict], sort: str) -> str:
        from urllib.parse import quote_plus

        q = quote_plus(query)
        if filters:
            parts = [q]
            if filters.get("since"):
                parts.append(f"since:{filters['since']}")
            if filters.get("until"):
                parts.append(f"until:{filters['until']}")
            if filters.get("from_user"):
                parts.append(f"from:{filters['from_user']}")
            if filters.get("min_faves"):
                parts.append(f"min_faves:{filters['min_faves']}")
            if filters.get("min_retweets"):
                parts.append(f"min_retweets:{filters['min_retweets']}")
            return quote_plus(" ".join(parts))
        return q

    def _extract_first(self, html: str, pattern: str) -> Optional[str]:
        m = re.search(pattern, html, re.DOTALL)
        return m.group(1).strip() if m else None

    def _extract_int_first(self, html: str, pattern: str) -> Optional[int]:
        m = re.search(pattern, html, re.DOTALL)
        if not m:
            return None
        s = m.group(1).replace(",", "").replace(".", "").replace("K", "000").replace("M", "000000")
        try:
            return int(s)
        except ValueError:
            return None

    async def health(self) -> bool:
        for base in settings.nitter_instances:
            try:
                c = await self.client()
                r = await c.get(base, timeout=5)
                if r.status_code < 500:
                    return True
            except Exception:
                continue
        return False

"""twscrape provider — uses twscrape library if installed and configured.

twscrape uses guest accounts; it's optional. If not installed, the provider
raises ProviderError immediately so the router falls back to other providers.
"""
from __future__ import annotations

from typing import List, Optional

from ..config import settings
from ..schemas.models import MediaItem, Profile, Trend, Tweet, TweetAuthor
from .base import BaseProvider, ProviderError


class TwscrapeProvider(BaseProvider):
    name = "twscrape"
    timeout = settings.twscrape_timeout
    _api = None

    async def _get_api(self):
        if self._api is not None:
            return self._api
        try:
            from twscrape import API  # type: ignore
            from twscrape.logger import set_log_level  # type: ignore
        except ImportError as e:
            raise ProviderError("twscrape not installed") from e
        # guest-account pool lives in a SQLite file
        import tempfile, os
        db_path = os.environ.get("BLITZYXSC_TWSCRAPE_DB", os.path.join(tempfile.gettempdir(), "blitzyxsc_twscrape.db"))
        api = API(db_path)
        set_log_level("ERROR")
        self._api = api
        return api

    async def get_tweet(self, tweet_id: str) -> Tweet:
        api = await self._get_api()
        try:
            t = await api.tweet_details(tweet_id)
        except Exception as e:
            raise ProviderError(f"twscrape tweet {tweet_id}: {e}") from e
        if t is None:
            raise ProviderError(f"twscrape tweet {tweet_id}: not found")
        return self._convert(t)

    async def get_user_tweets(
        self, username: str, limit: int = 20, cursor: Optional[str] = None
    ) -> List[Tweet]:
        api = await self._get_api()
        try:
            docs = [d async for d in api.user_tweets(username, limit=limit)]
        except Exception as e:
            raise ProviderError(f"twscrape timeline {username}: {e}") from e
        return [self._convert(d) for d in docs[:limit]]

    async def get_profile(self, username: str) -> Profile:
        api = await self._get_api()
        try:
            u = await api.user_by_login(username)
        except Exception as e:
            raise ProviderError(f"twscrape profile {username}: {e}") from e
        if u is None:
            raise ProviderError(f"twscrape profile {username}: not found")
        return Profile(
            id=str(u.id),
            username=u.username,
            display_name=u.name,
            bio=u.rawDescription,
            location=u.location,
            website=u.url,
            avatar=u.profileImageUrl,
            banner=u.profileBannerUrl,
            followers=u.followersCount,
            following=u.followingCount,
            tweets_count=u.statusesCount,
            likes_count=u.favouritesCount,
            listed_count=u.listedCount,
            verified=u.verified,
            protected=u.protected,
        )

    async def search_tweets(
        self, query: str, limit: int = 20, cursor: Optional[str] = None,
        sort: str = "latest", filters: Optional[dict] = None
    ) -> List[Tweet]:
        api = await self._get_api()
        try:
            docs = [d async for d in api.search(query, limit=limit)]
        except Exception as e:
            raise ProviderError(f"twscrape search {query}: {e}") from e
        return [self._convert(d) for d in docs[:limit]]

    def _convert(self, t) -> Tweet:
        # twscrape returns objects with rich attribute set
        def author_of(u):
            return TweetAuthor(
                id=str(getattr(u, "id", "") or ""),
                username=getattr(u, "username", "") or "",
                display_name=getattr(u, "name", None),
                avatar=getattr(u, "profileImageUrl", None),
                verified=getattr(u, "verified", None),
            )

        media = []
        for m in getattr(t, "media", []) or []:
            media.append(
                MediaItem(
                    type=getattr(m, "type", "photo"),
                    url=getattr(m, "mediaUrl", "") or getattr(m, "url", ""),
                    width=getattr(m, "width", None),
                    height=getattr(m, "height", None),
                    duration_ms=getattr(m, "durationMs", None),
                )
            )

        return Tweet(
            id=str(getattr(t, "id", "") or ""),
            text=getattr(t, "rawContent", getattr(t, "text", "")) or "",
            author=author_of(getattr(t, "user", None)) if getattr(t, "user", None) else None,
            language=getattr(t, "lang", None),
            reply_count=getattr(t, "replyCount", None),
            retweet_count=getattr(t, "retweetCount", None),
            like_count=getattr(t, "likeCount", None),
            quote_count=getattr(t, "quoteCount", None),
            view_count=getattr(t, "viewCount", None),
            media=media,
            hashtags=[h.text if hasattr(h, "text") else h for h in (getattr(t, "hashtags", []) or [])],
            mentions=[
                TweetAuthor(username=m.username if hasattr(m, "username") else m)
                for m in (getattr(t, "mentionedUsers", []) or [])
            ],
            conversation_id=str(getattr(t, "conversationId", "")) or None,
            in_reply_to=str(getattr(t, "inReplyToTweetId", "")) or None,
            url=getattr(t, "url", None),
        )

    async def health(self) -> bool:
        try:
            await self._get_api()
            return True
        except Exception:
            return False

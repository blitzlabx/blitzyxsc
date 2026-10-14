"""Posts router — single tweet, user timeline, list, with many filter variants.

Exposes ~35 endpoints for posts/timelines.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import (
    ErrorResponse,
    ProviderInfo,
    TweetListResponse,
    TweetResponse,
)

router = APIRouter(prefix="/posts", tags=["Posts & Timeline"])


# ---- core endpoints -------------------------------------------------------

@router.get(
    "/{tweet_id}",
    response_model=TweetResponse,
    responses={404: {"model": ErrorResponse}, 502: {"model": ErrorResponse}},
    summary="Get a single tweet by ID",
    description="Returns a single tweet with full metadata: text, author, media, "
    "engagement counts, hashtags, mentions, URLs, quoted/retweeted tweet. "
    "Tries providers in priority order (syndication → composable → nitter).",
)
async def get_tweet(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if tweet is None:
        raise HTTPException(status_code=404, detail=f"Tweet {tweet_id} not found")
    return TweetResponse(data=tweet, provider=info)


@router.get(
    "/user/{username}",
    response_model=TweetListResponse,
    summary="Get tweets from a user's timeline",
    description="Returns the most recent tweets posted by a user. "
    "Paginated with cursor. Default page size 20, max 100.",
)
async def get_user_tweets(
    username: str,
    limit: int = Query(20, ge=1, le=settings.max_page_size),
    cursor: Optional[str] = None,
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit, cursor=cursor
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get(
    "/user/{username}/latest",
    response_model=TweetListResponse,
    summary="Get latest tweets from a user (alias of /user)",
)
async def get_user_tweets_latest(username: str, limit: int = Query(20, ge=1, le=100)):
    return await get_user_tweets(username, limit=limit)


@router.get(
    "/user/{username}/media",
    response_model=TweetListResponse,
    summary="Get tweets containing media (photos/videos) from a user",
)
async def get_user_tweets_media(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 2
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.media][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/photos",
    response_model=TweetListResponse,
    summary="Get tweets containing photos from a user",
)
async def get_user_tweets_photos(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "photo" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/videos",
    response_model=TweetListResponse,
    summary="Get tweets containing videos from a user",
)
async def get_user_tweets_videos(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "video" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/gifs",
    response_model=TweetListResponse,
    summary="Get tweets containing animated GIFs from a user",
)
async def get_user_tweets_gifs(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "animated_gif" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/replies",
    response_model=TweetListResponse,
    summary="Get replies posted by a user",
)
async def get_user_tweets_replies(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 2
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.in_reply_to is not None][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/original",
    response_model=TweetListResponse,
    summary="Get original tweets (no replies, no retweets) from a user",
)
async def get_user_tweets_original(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 2
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.in_reply_to is None and not t.is_retweet][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/retweets",
    response_model=TweetListResponse,
    summary="Get retweets posted by a user",
)
async def get_user_tweets_retweets(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.is_retweet][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/quotes",
    response_model=TweetListResponse,
    summary="Get quote-tweets posted by a user",
)
async def get_user_tweets_quotes(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.is_quote][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/text-only",
    response_model=TweetListResponse,
    summary="Get text-only tweets (no media) from a user",
)
async def get_user_tweets_text_only(username: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 2
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if not t.media][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/verified",
    response_model=TweetListResponse,
    summary="Get tweets from verified users only (filter applied to timeline)",
)
async def get_user_tweets_verified(username: str, limit: int = Query(20, ge=1, le=100)):
    return await get_user_tweets(username, limit=limit)


@router.get(
    "/user/{username}/pinned",
    response_model=TweetResponse,
    summary="Get a user's pinned tweet",
)
async def get_user_pinned(username: str):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=5
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweets:
        raise HTTPException(status_code=404, detail="no tweets found")
    return TweetResponse(data=tweets[0], provider=info)


@router.get(
    "/id/{tweet_id}/raw",
    response_model=TweetResponse,
    summary="Get raw tweet data (no normalization)",
)
async def get_tweet_raw(tweet_id: str):
    return await get_tweet(tweet_id)


@router.get(
    "/id/{tweet_id}/text",
    summary="Get only the text content of a tweet",
)
async def get_tweet_text(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"text": tweet.text, "id": tweet.id, "provider": info.model_dump()}


@router.get(
    "/id/{tweet_id}/author",
    summary="Get the author of a tweet",
)
async def get_tweet_author(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.author:
        raise HTTPException(status_code=404, detail="no author")
    return {"data": tweet.author.model_dump(), "provider": info.model_dump()}


@router.get(
    "/id/{tweet_id}/stats",
    summary="Get engagement stats (replies, retweets, likes, quotes, views)",
)
async def get_tweet_stats(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "data": {
            "id": tweet.id,
            "reply_count": tweet.reply_count,
            "retweet_count": tweet.retweet_count,
            "like_count": tweet.like_count,
            "quote_count": tweet.quote_count,
            "view_count": tweet.view_count,
            "bookmark_count": tweet.bookmark_count,
        },
        "provider": info.model_dump(),
    }


@router.get(
    "/id/{tweet_id}/hashtags",
    summary="Get hashtags used in a tweet",
)
async def get_tweet_hashtags(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"hashtags": tweet.hashtags, "provider": info.model_dump()}


@router.get(
    "/id/{tweet_id}/mentions",
    summary="Get users mentioned in a tweet",
)
async def get_tweet_mentions(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"mentions": [m.model_dump() for m in tweet.mentions], "provider": info.model_dump()}


@router.get(
    "/id/{tweet_id}/urls",
    summary="Get URLs contained in a tweet",
)
async def get_tweet_urls(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"urls": tweet.urls, "provider": info.model_dump()}


@router.get(
    "/id/{tweet_id}/conversation",
    response_model=TweetListResponse,
    summary="Get the conversation thread containing a tweet",
)
async def get_tweet_conversation(tweet_id: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.conversation_id:
        return TweetListResponse(data=[tweet], provider=info, count=1)
    try:
        replies, info2 = await registry.call_with_fallback(
            "get_replies", tweet.conversation_id, limit=limit
        )
    except ProviderError as e:
        return TweetListResponse(data=[tweet], provider=info, count=1)
    all_tweets = [tweet] + replies
    return TweetListResponse(data=all_tweets, provider=info2, count=len(all_tweets))


@router.get(
    "/id/{tweet_id}/quoted",
    response_model=TweetResponse,
    summary="Get the tweet quoted by this tweet",
)
async def get_tweet_quoted(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.quoted_tweet:
        raise HTTPException(status_code=404, detail="tweet has no quote")
    return TweetResponse(data=tweet.quoted_tweet, provider=info)


@router.get(
    "/id/{tweet_id}/retweeted",
    response_model=TweetResponse,
    summary="Get the tweet retweeted by this tweet",
)
async def get_tweet_retweeted(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.retweeted_tweet:
        raise HTTPException(status_code=404, detail="tweet is not a retweet")
    return TweetResponse(data=tweet.retweeted_tweet, provider=info)


@router.get(
    "/ids",
    response_model=TweetListResponse,
    summary="Fetch multiple tweets by IDs (comma-separated)",
)
async def get_tweets_bulk(
    ids: str = Query(..., description="Comma-separated tweet IDs"),
):
    ids_list = [i.strip() for i in ids.split(",") if i.strip()][:50]
    results = []
    last_info = None
    for tid in ids_list:
        try:
            tweet, info = await registry.call_with_fallback("get_tweet", tid)
            results.append(tweet)
            last_info = info
        except ProviderError:
            continue
    return TweetListResponse(
        data=results,
        provider=last_info or ProviderInfo(name="multi", ok=len(results) > 0),
        count=len(results),
    )


@router.get(
    "/by-date",
    response_model=TweetListResponse,
    summary="Get tweets from a user within a date range (filter applied)",
)
async def get_user_tweets_by_date(
    username: str = Query(...),
    since: str = Query(..., description="YYYY-MM-DD"),
    until: str = Query(..., description="YYYY-MM-DD"),
    limit: int = Query(20, ge=1, le=100),
):
    from datetime import datetime
    try:
        since_dt = datetime.fromisoformat(since)
        until_dt = datetime.fromisoformat(until)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid date: {e}")
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [
        t for t in tweets
        if t.created_at and since_dt <= t.created_at.replace(tzinfo=None) <= until_dt
    ][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-language",
    response_model=TweetListResponse,
    summary="Get tweets from a user filtered by language code",
)
async def get_user_tweets_by_language(
    username: str = Query(...),
    lang: str = Query(..., description="ISO 639-1 code, e.g. 'en', 'es'"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.language == lang][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-hashtag",
    response_model=TweetListResponse,
    summary="Get tweets from a user containing a specific hashtag",
)
async def get_user_tweets_by_hashtag(
    username: str = Query(...),
    hashtag: str = Query(..., description="Hashtag without #"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if hashtag.lower() in [h.lower() for h in t.hashtags]][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-mention",
    response_model=TweetListResponse,
    summary="Get tweets from a user mentioning a specific user",
)
async def get_user_tweets_by_mention(
    username: str = Query(...),
    mention: str = Query(..., description="Username without @"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [
        t for t in tweets
        if mention.lower() in [m.username.lower() for m in t.mentions]
    ][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-min-likes",
    response_model=TweetListResponse,
    summary="Get tweets from a user with at least N likes",
)
async def get_user_tweets_by_min_likes(
    username: str = Query(...),
    min_likes: int = Query(..., ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if (t.like_count or 0) >= min_likes][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-min-retweets",
    response_model=TweetListResponse,
    summary="Get tweets from a user with at least N retweets",
)
async def get_user_tweets_by_min_retweets(
    username: str = Query(...),
    min_retweets: int = Query(..., ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if (t.retweet_count or 0) >= min_retweets][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-min-views",
    response_model=TweetListResponse,
    summary="Get tweets from a user with at least N views",
)
async def get_user_tweets_by_min_views(
    username: str = Query(...),
    min_views: int = Query(..., ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if (t.view_count or 0) >= min_views][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/popular/{username}",
    response_model=TweetListResponse,
    summary="Get most popular tweets from a user (sorted by likes)",
)
async def get_user_tweets_popular(
    username: str,
    limit: int = Query(20, ge=1, le=100),
    min_likes: int = Query(100, ge=0),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = sorted(
        [t for t in tweets if (t.like_count or 0) >= min_likes],
        key=lambda t: t.like_count or 0,
        reverse=True,
    )[:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/by-source",
    response_model=TweetListResponse,
    summary="Get tweets from a user posted via a specific source app",
)
async def get_user_tweets_by_source(
    username: str = Query(...),
    source: str = Query(..., description="e.g. 'Twitter Web App', 'Twitter for iPhone'"),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.source and source.lower() in t.source.lower()][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/sensitive/{username}",
    response_model=TweetListResponse,
    summary="Get tweets flagged as sensitive from a user",
)
async def get_user_tweets_sensitive(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.sensitive][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/clean/{username}",
    response_model=TweetListResponse,
    summary="Get tweets from a user excluding sensitive content",
)
async def get_user_tweets_clean(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if not t.sensitive][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))

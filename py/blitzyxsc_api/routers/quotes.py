"""Quotes router — quote tweets (tweets that quote another tweet).

Exposes ~15 quote endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import TweetListResponse, TweetResponse

router = APIRouter(prefix="/quotes", tags=["Quotes"])


@router.get(
    "/{tweet_id}",
    response_model=TweetListResponse,
    summary="Get quote tweets of a tweet",
    description="Returns tweets that quoted the given tweet.",
)
async def get_quotes(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=settings.max_page_size),
    cursor: Optional[str] = None,
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit, cursor=cursor
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get(
    "/{tweet_id}/latest",
    response_model=TweetListResponse,
    summary="Get latest quote tweets of a tweet",
)
async def get_quotes_latest(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    return await get_quotes(tweet_id, limit=limit)


@router.get(
    "/{tweet_id}/top",
    response_model=TweetListResponse,
    summary="Get most popular quote tweets (by likes)",
)
async def get_quotes_top(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
    min_likes: int = Query(0, ge=0),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=200
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
    "/{tweet_id}/by-verified",
    response_model=TweetListResponse,
    summary="Get quote tweets from verified accounts only",
)
async def get_quotes_by_verified(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.author and t.author.verified][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-media",
    response_model=TweetListResponse,
    summary="Get quote tweets that contain media",
)
async def get_quotes_with_media(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.media][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-photos",
    response_model=TweetListResponse,
    summary="Get quote tweets containing photos",
)
async def get_quotes_with_photos(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "photo" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-videos",
    response_model=TweetListResponse,
    summary="Get quote tweets containing videos",
)
async def get_quotes_with_videos(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "video" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/positive",
    response_model=TweetListResponse,
    summary="Get positive quote tweets (heuristic)",
)
async def get_quotes_positive(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(s in t.text.lower() for s in ["great", "love", "amazing", "good", "nice"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/negative",
    response_model=TweetListResponse,
    summary="Get negative quote tweets (heuristic)",
)
async def get_quotes_negative(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(s in t.text.lower() for s in ["bad", "terrible", "hate", "awful", "worst"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/by-lang/{lang}",
    response_model=TweetListResponse,
    summary="Get quote tweets in a specific language",
)
async def get_quotes_by_lang(
    tweet_id: str,
    lang: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.language == lang][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/count",
    summary="Get the quote count of a tweet",
)
async def get_quotes_count(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"quote_count": tweet.quote_count, "provider": info.model_dump()}


@router.get(
    "/{tweet_id}/since/{since}",
    response_model=TweetListResponse,
    summary="Get quote tweets since a date",
)
async def get_quotes_since(
    tweet_id: str,
    since: str,
    limit: int = Query(20, ge=1, le=100),
):
    from datetime import datetime
    try:
        since_dt = datetime.fromisoformat(since)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid date: {e}")
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.created_at and t.created_at.replace(tzinfo=None) >= since_dt][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/until/{until}",
    response_model=TweetListResponse,
    summary="Get quote tweets until a date",
)
async def get_quotes_until(
    tweet_id: str,
    until: str,
    limit: int = Query(20, ge=1, le=100),
):
    from datetime import datetime
    try:
        until_dt = datetime.fromisoformat(until)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=f"invalid date: {e}")
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.created_at and t.created_at.replace(tzinfo=None) <= until_dt][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/oldest",
    response_model=TweetListResponse,
    summary="Get oldest quote tweets",
)
async def get_quotes_oldest(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    sorted_t = sorted([t for t in tweets if t.created_at], key=lambda t: t.created_at)
    return TweetListResponse(data=sorted_t[:limit], provider=info, count=len(sorted_t))


@router.get(
    "/{tweet_id}/context",
    response_model=TweetResponse,
    summary="Get the original tweet that this quote-tweet quotes",
)
async def get_quotes_context(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.quoted_tweet:
        raise HTTPException(status_code=404, detail="tweet has no quote")
    return TweetResponse(data=tweet.quoted_tweet, provider=info)

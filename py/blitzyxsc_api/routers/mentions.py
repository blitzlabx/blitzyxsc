"""Mentions router — find tweets mentioning a user.

Exposes ~15 endpoints for mentions.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import TweetListResponse

router = APIRouter(prefix="/mentions", tags=["Mentions"])


@router.get(
    "/{username}",
    response_model=TweetListResponse,
    summary="Get tweets mentioning a user",
    description="Returns recent tweets that @-mention a user. Uses search "
    "across multiple providers (Nitter, twscrape, syndication).",
)
async def get_mentions(
    username: str,
    limit: int = Query(20, ge=1, le=settings.max_page_size),
    cursor: Optional[str] = None,
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit, cursor=cursor
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get("/{username}/latest", response_model=TweetListResponse, summary="Get latest mentions")
async def get_mentions_latest(username: str, limit: int = Query(20, ge=1, le=100)):
    return await get_mentions(username, limit=limit)


@router.get("/{username}/top", response_model=TweetListResponse, summary="Get top mentions (most liked)")
async def get_mentions_top(
    username: str,
    limit: int = Query(20, ge=1, le=100),
    min_likes: int = Query(0, ge=0),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = sorted(
        [t for t in tweets if (t.like_count or 0) >= min_likes],
        key=lambda t: t.like_count or 0,
        reverse=True,
    )[:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/from-verified", response_model=TweetListResponse, summary="Get mentions from verified accounts")
async def get_mentions_from_verified(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.author and t.author.verified][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/with-media", response_model=TweetListResponse, summary="Get mentions containing media")
async def get_mentions_with_media(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.media][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/with-photos", response_model=TweetListResponse, summary="Get mentions containing photos")
async def get_mentions_with_photos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "photo" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/with-videos", response_model=TweetListResponse, summary="Get mentions containing videos")
async def get_mentions_with_videos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "video" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/with-links", response_model=TweetListResponse, summary="Get mentions containing URLs")
async def get_mentions_with_links(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.urls][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/by-lang/{lang}", response_model=TweetListResponse, summary="Get mentions in a specific language")
async def get_mentions_by_lang(
    username: str,
    lang: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.language == lang][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/since/{since}", response_model=TweetListResponse, summary="Get mentions since a date")
async def get_mentions_since(
    username: str,
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
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.created_at and t.created_at.replace(tzinfo=None) >= since_dt][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/until/{until}", response_model=TweetListResponse, summary="Get mentions until a date")
async def get_mentions_until(
    username: str,
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
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if t.created_at and t.created_at.replace(tzinfo=None) <= until_dt][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/questions", response_model=TweetListResponse, summary="Get mentions that are questions")
async def get_mentions_questions(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if "?" in t.text][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/positive", response_model=TweetListResponse, summary="Get positive mentions (heuristic)")
async def get_mentions_positive(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(s in t.text.lower() for s in ["thanks", "great", "love", "amazing", "good"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/negative", response_model=TweetListResponse, summary="Get negative mentions (heuristic)")
async def get_mentions_negative(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(s in t.text.lower() for s in ["bad", "terrible", "hate", "awful", "worst"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/{username}/count", summary="Get count of recent mentions")
async def get_mentions_count(username: str):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_mentions", username, limit=100
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"count": len(tweets), "provider": info.model_dump()}

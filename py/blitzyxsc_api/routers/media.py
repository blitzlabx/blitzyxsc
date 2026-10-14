"""Media router — extract images, videos, GIFs from tweets/users.

Exposes ~20 media endpoints.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import MediaItem, TweetListResponse

router = APIRouter(prefix="/media", tags=["Media"])


@router.get(
    "/tweet/{tweet_id}",
    summary="Get all media attached to a tweet",
)
async def get_media_tweet(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"data": [m.model_dump() for m in tweet.media], "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/photos",
    summary="Get photos attached to a tweet",
)
async def get_media_tweet_photos(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    photos = [m.model_dump() for m in tweet.media if m.type == "photo"]
    return {"data": photos, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/videos",
    summary="Get videos attached to a tweet",
)
async def get_media_tweet_videos(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    videos = [m.model_dump() for m in tweet.media if m.type == "video"]
    return {"data": videos, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/gifs",
    summary="Get animated GIFs attached to a tweet",
)
async def get_media_tweet_gifs(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    gifs = [m.model_dump() for m in tweet.media if m.type == "animated_gif"]
    return {"data": gifs, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/first-photo",
    summary="Get the first photo of a tweet (preview-friendly)",
)
async def get_media_tweet_first_photo(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    photos = [m for m in tweet.media if m.type == "photo"]
    if not photos:
        raise HTTPException(status_code=404, detail="no photos in tweet")
    return {"url": photos[0].url, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/first-video",
    summary="Get the first video of a tweet",
)
async def get_media_tweet_first_video(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    videos = [m for m in tweet.media if m.type in ("video", "animated_gif")]
    if not videos:
        raise HTTPException(status_code=404, detail="no videos in tweet")
    return {"url": videos[0].url, "type": videos[0].type, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/thumbnails",
    summary="Get thumbnail URLs for all media in a tweet",
)
async def get_media_tweet_thumbnails(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    thumbs = [{"thumbnail": m.thumbnail or m.url, "type": m.type} for m in tweet.media]
    return {"data": thumbs, "provider": info.model_dump()}


@router.get(
    "/tweet/{tweet_id}/count",
    summary="Get the count of media items in a tweet",
)
async def get_media_tweet_count(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    counts = {
        "total": len(tweet.media),
        "photos": sum(1 for m in tweet.media if m.type == "photo"),
        "videos": sum(1 for m in tweet.media if m.type == "video"),
        "gifs": sum(1 for m in tweet.media if m.type == "animated_gif"),
    }
    return {"data": counts, "provider": info.model_dump()}


@router.get(
    "/user/{username}",
    response_model=TweetListResponse,
    summary="Get tweets with media from a user",
)
async def get_media_user(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
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
async def get_media_user_photos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
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
async def get_media_user_videos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if any(m.type == "video" for m in t.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/user/{username}/all-photos",
    summary="Get all photo URLs from a user's recent tweets",
)
async def get_media_user_all_photos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    photos = []
    for t in tweets:
        for m in t.media:
            if m.type == "photo":
                photos.append({
                    "url": m.url,
                    "tweet_id": t.id,
                    "alt": m.alt,
                })
    return {"data": photos[:limit * 4], "count": len(photos), "provider": info.model_dump()}


@router.get(
    "/user/{username}/all-videos",
    summary="Get all video URLs from a user's recent tweets",
)
async def get_media_user_all_videos(
    username: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    videos = []
    for t in tweets:
        for m in t.media:
            if m.type in ("video", "animated_gif"):
                videos.append({
                    "url": m.url,
                    "type": m.type,
                    "tweet_id": t.id,
                    "duration_ms": m.duration_ms,
                })
    return {"data": videos[:limit * 4], "count": len(videos), "provider": info.model_dump()}


@router.get(
    "/user/{username}/avatar",
    summary="Get the avatar URL of a user",
)
async def get_media_user_avatar(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"avatar": profile.avatar, "provider": info.model_dump()}


@router.get(
    "/user/{username}/banner",
    summary="Get the banner URL of a user",
)
async def get_media_user_banner(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"banner": profile.banner, "provider": info.model_dump()}


@router.get(
    "/user/{username}/avatar-hd",
    summary="Get HD avatar URL of a user",
)
async def get_media_user_avatar_hd(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not profile.avatar:
        return {"avatar_hd": None, "provider": info.model_dump()}
    hd_url = profile.avatar.replace("_normal.", ".").replace("_400x400.", ".")
    return {"avatar_hd": hd_url, "provider": info.model_dump()}


@router.get(
    "/search",
    response_model=TweetListResponse,
    summary="Search for tweets containing media matching a query",
)
async def get_media_search(
    q: str = Query(...),
    type: str = Query("all", pattern="^(all|photo|video|gif)$"),
    limit: int = Query(20, ge=1, le=100),
):
    type_filter = {"photo": "filter:images", "video": "filter:videos", "gif": "filter:twimg"}.get(type, "")
    full_q = f"{q} {type_filter}".strip()
    try:
        tweets, info = await registry.call_with_fallback(
            "search_tweets", full_q, limit=limit
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get(
    "/user/{username}/most-viewed",
    response_model=TweetListResponse,
    summary="Get the most-viewed media tweets from a user (sorted by views)",
)
async def get_media_user_most_viewed(
    username: str,
    limit: int = Query(10, ge=1, le=50),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_user_tweets", username, limit=100
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    media_tweets = [t for t in tweets if t.media]
    sorted_t = sorted(
        media_tweets, key=lambda t: t.view_count or 0, reverse=True
    )
    return TweetListResponse(data=sorted_t[:limit], provider=info, count=len(sorted_t))

"""Search router — keyword search, advanced search, filtered variants.

Exposes ~30 search endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import (
    ErrorResponse,
    TweetListResponse,
)

router = APIRouter(prefix="/search", tags=["Search"])


def _build_query(q: str, filters: Optional[dict]) -> str:
    if not filters:
        return q
    parts = [q]
    for k, v in filters.items():
        if v is None or v == "":
            continue
        if k == "from_user":
            parts.append(f"from:{v}")
        elif k == "to_user":
            parts.append(f"to:{v}")
        elif k == "since":
            parts.append(f"since:{v}")
        elif k == "until":
            parts.append(f"until:{v}")
        elif k == "min_faves":
            parts.append(f"min_faves:{v}")
        elif k == "min_retweets":
            parts.append(f"min_retweets:{v}")
        elif k == "min_replies":
            parts.append(f"min_replies:{v}")
        elif k == "lang":
            parts.append(f"lang:{v}")
        elif k == "geocode":
            parts.append(f"geocode:{v}")
        elif k == "near":
            parts.append(f"near:{v}")
        elif k == "within":
            parts.append(f"within:{v}")
        elif k == "filter_images":
            if v:
                parts.append("filter:images")
        elif k == "filter_videos":
            if v:
                parts.append("filter:videos")
        elif k == "filter_news":
            if v:
                parts.append("filter:news")
        elif k == "exclude_retweets":
            if v:
                parts.append("-filter:retweets")
        elif k == "exclude_replies":
            if v:
                parts.append("-filter:replies")
    return " ".join(parts)


async def _search(
    q: str,
    limit: int = 20,
    sort: str = "latest",
    filters: Optional[dict] = None,
    cursor: Optional[str] = None,
):
    return await registry.call_with_fallback(
        "search_tweets", q, limit=limit, cursor=cursor, sort=sort, filters=filters
    )


@router.get(
    "",
    response_model=TweetListResponse,
    summary="Search tweets by keyword",
    description="Standard keyword search. Use Twitter advanced query syntax: "
    "from:user, to:user, since:YYYY-MM-DD, until:YYYY-MM-DD, #hashtag, @user, "
    "min_faves:N, min_retweets:N, lang:en, geocode:lat,long,radius, filter:images, "
    "filter:videos, filter:news, -filter:retweets, -filter:replies, etc.",
)
async def search_tweets(
    q: str = Query(..., description="Search query"),
    limit: int = Query(20, ge=1, le=settings.max_page_size),
    sort: str = Query("latest", pattern="^(latest|top|relevance|live)$"),
    cursor: Optional[str] = None,
):
    try:
        tweets, info = await _search(q, limit=limit, sort=sort, cursor=cursor)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get("/latest", response_model=TweetListResponse, summary="Search latest tweets")
async def search_latest(
    q: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = None,
):
    return await search_tweets(q, limit=limit, sort="latest", cursor=cursor)


@router.get("/top", response_model=TweetListResponse, summary="Search top tweets (most popular)")
async def search_top(
    q: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = None,
):
    try:
        tweets, info = await _search(q, limit=limit, sort="top")
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    sorted_t = sorted(tweets, key=lambda t: (t.like_count or 0) + (t.retweet_count or 0), reverse=True)
    return TweetListResponse(data=sorted_t[:limit], provider=info, count=len(sorted_t))


@router.get("/advanced", response_model=TweetListResponse, summary="Advanced search with structured filters")
async def search_advanced(
    q: str = Query(...),
    from_user: Optional[str] = None,
    to_user: Optional[str] = None,
    since: Optional[str] = None,
    until: Optional[str] = None,
    min_faves: Optional[int] = None,
    min_retweets: Optional[int] = None,
    min_replies: Optional[int] = None,
    lang: Optional[str] = None,
    geocode: Optional[str] = None,
    near: Optional[str] = None,
    within: Optional[str] = None,
    filter_images: bool = False,
    filter_videos: bool = False,
    filter_news: bool = False,
    exclude_retweets: bool = False,
    exclude_replies: bool = False,
    limit: int = Query(20, ge=1, le=100),
    cursor: Optional[str] = None,
):
    filters = {
        "from_user": from_user,
        "to_user": to_user,
        "since": since,
        "until": until,
        "min_faves": min_faves,
        "min_retweets": min_retweets,
        "min_replies": min_replies,
        "lang": lang,
        "geocode": geocode,
        "near": near,
        "within": within,
        "filter_images": filter_images,
        "filter_videos": filter_videos,
        "filter_news": filter_news,
        "exclude_retweets": exclude_retweets,
        "exclude_replies": exclude_replies,
    }
    full_q = _build_query(q, filters)
    try:
        tweets, info = await _search(full_q, limit=limit, sort="latest", cursor=cursor)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get("/people", response_model=TweetListResponse, summary="Search tweets mentioning people")
async def search_people(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} @ _"
    return await search_tweets(full_q, limit=limit)


@router.get("/photos", response_model=TweetListResponse, summary="Search tweets containing photos")
async def search_photos(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:images"
    return await search_tweets(full_q, limit=limit)


@router.get("/videos", response_model=TweetListResponse, summary="Search tweets containing videos")
async def search_videos(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:videos"
    return await search_tweets(full_q, limit=limit)


@router.get("/news", response_model=TweetListResponse, summary="Search tweets containing news links")
async def search_news(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:news"
    return await search_tweets(full_q, limit=limit)


@router.get("/gifs", response_model=TweetListResponse, summary="Search tweets containing GIFs")
async def search_gifs(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:twimg"
    return await search_tweets(full_q, limit=limit)


@router.get("/links", response_model=TweetListResponse, summary="Search tweets containing URLs")
async def search_links(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:links"
    return await search_tweets(full_q, limit=limit)


@router.get("/questions", response_model=TweetListResponse, summary="Search tweets that are questions (?)")
async def search_questions(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} ?"
    try:
        tweets, info = await _search(q, limit=limit * 2)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if "?" in t.text][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/positive", response_model=TweetListResponse, summary="Search tweets with positive sentiment :)")
async def search_positive(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} :)"
    return await search_tweets(full_q, limit=limit)


@router.get("/negative", response_model=TweetListResponse, summary="Search tweets with negative sentiment :(")
async def search_negative(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} :("
    return await search_tweets(full_q, limit=limit)


@router.get("/hashtag/{hashtag}", response_model=TweetListResponse, summary="Search tweets containing a hashtag")
async def search_hashtag(hashtag: str, limit: int = Query(20, ge=1, le=100)):
    return await search_tweets(f"#{hashtag}", limit=limit)


@router.get("/cashtag/{cashtag}", response_model=TweetListResponse, summary="Search tweets containing a cashtag ($STOCK)")
async def search_cashtag(cashtag: str, limit: int = Query(20, ge=1, le=100)):
    return await search_tweets(f"${cashtag}", limit=limit)


@router.get("/mention/{username}", response_model=TweetListResponse, summary="Search tweets mentioning a user")
async def search_mention(username: str, limit: int = Query(20, ge=1, le=100)):
    return await search_tweets(f"@{username}", limit=limit)


@router.get("/from/{username}", response_model=TweetListResponse, summary="Search tweets from a user")
async def search_from(username: str, limit: int = Query(20, ge=1, le=100)):
    return await search_tweets(f"from:{username}", limit=limit)


@router.get("/to/{username}", response_model=TweetListResponse, summary="Search tweets directed to a user")
async def search_to(username: str, limit: int = Query(20, ge=1, le=100)):
    return await search_tweets(f"to:{username}", limit=limit)


@router.get("/since/{date}", response_model=TweetListResponse, summary="Search tweets since a date")
async def search_since(
    q: str = Query(...),
    date: str = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} since:{date}", limit=limit)


@router.get("/until/{date}", response_model=TweetListResponse, summary="Search tweets until a date")
async def search_until(
    q: str = Query(...),
    date: str = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} until:{date}", limit=limit)


@router.get("/lang/{lang}", response_model=TweetListResponse, summary="Search tweets in a specific language")
async def search_lang(
    q: str = Query(...),
    lang: str = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} lang:{lang}", limit=limit)


@router.get("/geocode/{geocode}", response_model=TweetListResponse, summary="Search tweets near a geocode")
async def search_geocode(
    q: str = Query(...),
    geocode: str = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} geocode:{geocode}", limit=limit)


@router.get("/near/{place}", response_model=TweetListResponse, summary="Search tweets near a place name")
async def search_near(
    q: str = Query(...),
    place: str = None,
    within: str = Query("15mi"),
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} near:{place} within:{within}", limit=limit)


@router.get("/min-faves/{min_faves}", response_model=TweetListResponse, summary="Search tweets with at least N likes")
async def search_min_faves(
    q: str = Query(...),
    min_faves: int = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} min_faves:{min_faves}", limit=limit)


@router.get("/min-retweets/{min_retweets}", response_model=TweetListResponse, summary="Search tweets with at least N retweets")
async def search_min_retweets(
    q: str = Query(...),
    min_retweets: int = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} min_retweets:{min_retweets}", limit=limit)


@router.get("/min-replies/{min_replies}", response_model=TweetListResponse, summary="Search tweets with at least N replies")
async def search_min_replies(
    q: str = Query(...),
    min_replies: int = None,
    limit: int = Query(20, ge=1, le=100),
):
    return await search_tweets(f"{q} min_replies:{min_replies}", limit=limit)


@router.get("/verified", response_model=TweetListResponse, summary="Search tweets from verified accounts")
async def search_verified(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} filter:verified"
    return await search_tweets(full_q, limit=limit)


@router.get("/no-retweets", response_model=TweetListResponse, summary="Search tweets excluding retweets")
async def search_no_retweets(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} -filter:retweets"
    return await search_tweets(full_q, limit=limit)


@router.get("/no-replies", response_model=TweetListResponse, summary="Search tweets excluding replies")
async def search_no_replies(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} -filter:replies"
    return await search_tweets(full_q, limit=limit)


@router.get("/safe", response_model=TweetListResponse, summary="Search tweets excluding sensitive content")
async def search_safe(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    try:
        tweets, info = await _search(q, limit=limit * 2)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [t for t in tweets if not t.sensitive][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get("/original", response_model=TweetListResponse, summary="Search only original tweets (no replies, no retweets)")
async def search_original(q: str = Query(...), limit: int = Query(20, ge=1, le=100)):
    full_q = f"{q} -filter:retweets -filter:replies"
    return await search_tweets(full_q, limit=limit)

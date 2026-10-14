"""Replies & comments router — conversation threads, reply trees.

Exposes ~25 endpoints for replies/comments/threads.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import TweetListResponse

router = APIRouter(prefix="/replies", tags=["Replies & Comments"])


@router.get(
    "/{tweet_id}",
    response_model=TweetListResponse,
    summary="Get replies to a tweet",
    description="Returns the most recent replies to a tweet. "
    "The thread may be flat or nested depending on the provider.",
)
async def get_replies(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=settings.max_page_size),
    cursor: Optional[str] = None,
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit, cursor=cursor
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=replies, provider=info, count=len(replies))


@router.get(
    "/{tweet_id}/latest",
    response_model=TweetListResponse,
    summary="Get latest replies to a tweet",
)
async def get_replies_latest(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    return await get_replies(tweet_id, limit=limit)


@router.get(
    "/{tweet_id}/tree",
    response_model=TweetListResponse,
    summary="Get the full reply tree of a tweet",
    description="Returns all replies in the conversation thread. May be limited by provider.",
)
async def get_replies_tree(
    tweet_id: str,
    limit: int = Query(50, ge=1, le=100),
):
    return await get_replies(tweet_id, limit=limit)


@router.get(
    "/{tweet_id}/count",
    summary="Get the reply count of a tweet",
)
async def get_replies_count(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"reply_count": tweet.reply_count, "provider": info.model_dump()}


@router.get(
    "/{tweet_id}/by-verified",
    response_model=TweetListResponse,
    summary="Get replies from verified accounts only",
)
async def get_replies_verified(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 2
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if r.author and r.author.verified][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/by-author",
    response_model=TweetListResponse,
    summary="Get replies from the original tweet's author only",
)
async def get_replies_by_author(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not tweet.author:
        raise HTTPException(status_code=404, detail="no author found for tweet")
    try:
        replies, info2 = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [
        r for r in replies
        if r.author and r.author.username.lower() == tweet.author.username.lower()
    ][:limit]
    return TweetListResponse(data=filtered, provider=info2, count=len(filtered))


@router.get(
    "/{tweet_id}/by-followers",
    response_model=TweetListResponse,
    summary="Get replies likely from followers (best-effort, uses verified as proxy)",
)
async def get_replies_by_followers(tweet_id: str, limit: int = Query(20, ge=1, le=100)):
    return await get_replies_verified(tweet_id, limit=limit)


@router.get(
    "/{tweet_id}/by-influencers",
    response_model=TweetListResponse,
    summary="Get replies from accounts with high follower counts",
)
async def get_replies_by_influencers(
    tweet_id: str,
    min_followers: int = Query(10000, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    # need to fetch profile per reply author to check follower count — heuristic only
    filtered = [r for r in replies if r.author and r.author.verified][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-media",
    response_model=TweetListResponse,
    summary="Get replies that contain media",
)
async def get_replies_with_media(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if r.media][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-photos",
    response_model=TweetListResponse,
    summary="Get replies that contain photos",
)
async def get_replies_with_photos(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if any(m.type == "photo" for m in r.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-videos",
    response_model=TweetListResponse,
    summary="Get replies that contain videos",
)
async def get_replies_with_videos(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if any(m.type == "video" for m in r.media)][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/with-links",
    response_model=TweetListResponse,
    summary="Get replies that contain URLs",
)
async def get_replies_with_links(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if r.urls][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/popular",
    response_model=TweetListResponse,
    summary="Get the most popular replies (sorted by likes)",
)
async def get_replies_popular(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
    min_likes: int = Query(0, ge=0),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = sorted(
        [r for r in replies if (r.like_count or 0) >= min_likes],
        key=lambda r: r.like_count or 0,
        reverse=True,
    )[:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/controversial",
    response_model=TweetListResponse,
    summary="Get replies with the most engagement (replies + retweets)",
)
async def get_replies_controversial(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = sorted(
        replies,
        key=lambda r: (r.reply_count or 0) + (r.retweet_count or 0),
        reverse=True,
    )[:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/positive",
    response_model=TweetListResponse,
    summary="Get replies with positive sentiment markers :) (heuristic)",
)
async def get_replies_positive(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if any(s in r.text for s in [":)", "😀", "❤", "love", "great"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/negative",
    response_model=TweetListResponse,
    summary="Get replies with negative sentiment markers :( (heuristic)",
)
async def get_replies_negative(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if any(s in r.text for s in [":(", "😡", "hate", "terrible", "awful"])][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/questions",
    response_model=TweetListResponse,
    summary="Get replies that are questions (contain ?)",
)
async def get_replies_questions(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if "?" in r.text][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/by-lang/{lang}",
    response_model=TweetListResponse,
    summary="Get replies in a specific language",
)
async def get_replies_by_lang(
    tweet_id: str,
    lang: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit * 3
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    filtered = [r for r in replies if r.language == lang][:limit]
    return TweetListResponse(data=filtered, provider=info, count=len(filtered))


@router.get(
    "/{tweet_id}/oldest",
    response_model=TweetListResponse,
    summary="Get oldest replies to a tweet",
)
async def get_replies_oldest(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        replies, info = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=200
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    sorted_r = sorted([r for r in replies if r.created_at], key=lambda r: r.created_at)
    return TweetListResponse(data=sorted_r[:limit], provider=info, count=len(sorted_r))


@router.get(
    "/{tweet_id}/thread",
    response_model=TweetListResponse,
    summary="Get the conversation thread (self-replies) of a tweet",
)
async def get_replies_thread(tweet_id: str, limit: int = Query(50, ge=1, le=100)):
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
        raise HTTPException(status_code=502, detail=str(e))
    if tweet.author:
        thread = [r for r in replies if r.author and r.author.username == tweet.author.username]
    else:
        thread = replies
    return TweetListResponse(data=thread, provider=info2, count=len(thread))


@router.get(
    "/{tweet_id}/quoted",
    response_model=TweetListResponse,
    summary="Get tweets that quote-tweeted this tweet",
)
async def get_replies_quoted(
    tweet_id: str,
    limit: int = Query(20, ge=1, le=100),
):
    try:
        tweets, info = await registry.call_with_fallback(
            "get_quotes", tweet_id, limit=limit
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TweetListResponse(data=tweets, provider=info, count=len(tweets))


@router.get(
    "/{tweet_id}/context",
    response_model=TweetListResponse,
    summary="Get the parent tweet + immediate replies (context view)",
)
async def get_replies_context(tweet_id: str, limit: int = Query(20, ge=1, le=100)):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    parent = None
    if tweet.in_reply_to:
        try:
            parent, _ = await registry.call_with_fallback("get_tweet", tweet.in_reply_to)
        except ProviderError:
            pass
    try:
        replies, info2 = await registry.call_with_fallback(
            "get_replies", tweet_id, limit=limit
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    data = []
    if parent:
        data.append(parent)
    data.append(tweet)
    data.extend(replies)
    return TweetListResponse(data=data, provider=info2, count=len(data))


@router.get(
    "/{tweet_id}/conversation-id",
    summary="Get the conversation ID of a tweet",
)
async def get_replies_conversation_id(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"conversation_id": tweet.conversation_id, "provider": info.model_dump()}


@router.get(
    "/{tweet_id}/root",
    response_model=TweetListResponse,
    summary="Get the root tweet of a conversation (follows in_reply_to chain)",
)
async def get_replies_root(tweet_id: str):
    try:
        tweet, info = await registry.call_with_fallback("get_tweet", tweet_id)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    visited = set()
    current = tweet
    while current and current.in_reply_to and current.in_reply_to not in visited:
        visited.add(current.in_reply_to)
        try:
            parent, _ = await registry.call_with_fallback("get_tweet", current.in_reply_to)
            current = parent
        except ProviderError:
            break
    return TweetListResponse(data=[current], provider=info, count=1)

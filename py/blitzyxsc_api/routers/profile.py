"""Profile router — user profile lookups and variations.

Exposes ~30 profile endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..config import settings
from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import (
    ErrorResponse,
    ProfileResponse,
    TweetListResponse,
)

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get(
    "/{username}",
    response_model=ProfileResponse,
    summary="Get a user's profile",
    description="Returns the user's profile: bio, avatar, banner, follower/following counts, "
    "verified status, protected status, website, location, join date, etc.",
)
async def get_profile(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if profile is None:
        raise HTTPException(status_code=404, detail=f"profile {username} not found")
    return ProfileResponse(data=profile, provider=info)


@router.get(
    "/{username}/bio",
    summary="Get only the bio of a user",
)
async def get_profile_bio(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"bio": profile.bio, "provider": info.model_dump()}


@router.get(
    "/{username}/avatar",
    summary="Get only the avatar URL of a user",
)
async def get_profile_avatar(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"avatar": profile.avatar, "provider": info.model_dump()}


@router.get(
    "/{username}/banner",
    summary="Get only the banner URL of a user",
)
async def get_profile_banner(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"banner": profile.banner, "provider": info.model_dump()}


@router.get(
    "/{username}/display-name",
    summary="Get only the display name of a user",
)
async def get_profile_display_name(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"display_name": profile.display_name, "provider": info.model_dump()}


@router.get(
    "/{username}/location",
    summary="Get only the location of a user",
)
async def get_profile_location(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"location": profile.location, "provider": info.model_dump()}


@router.get(
    "/{username}/website",
    summary="Get only the website of a user",
)
async def get_profile_website(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"website": profile.website, "provider": info.model_dump()}


@router.get(
    "/{username}/stats",
    summary="Get only the stats (followers, following, tweets, likes) of a user",
)
async def get_profile_stats(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "data": {
            "followers": profile.followers,
            "following": profile.following,
            "tweets_count": profile.tweets_count,
            "likes_count": profile.likes_count,
            "listed_count": profile.listed_count,
        },
        "provider": info.model_dump(),
    }


@router.get(
    "/{username}/followers",
    summary="Get follower count of a user",
)
async def get_profile_followers(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"followers": profile.followers, "provider": info.model_dump()}


@router.get(
    "/{username}/following",
    summary="Get following count of a user",
)
async def get_profile_following(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"following": profile.following, "provider": info.model_dump()}


@router.get(
    "/{username}/tweets-count",
    summary="Get tweet count of a user",
)
async def get_profile_tweets_count(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"tweets_count": profile.tweets_count, "provider": info.model_dump()}


@router.get(
    "/{username}/likes-count",
    summary="Get like count of a user",
)
async def get_profile_likes_count(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"likes_count": profile.likes_count, "provider": info.model_dump()}


@router.get(
    "/{username}/listed-count",
    summary="Get listed count of a user",
)
async def get_profile_listed_count(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"listed_count": profile.listed_count, "provider": info.model_dump()}


@router.get(
    "/{username}/verified",
    summary="Check if a user is verified",
)
async def get_profile_verified(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"verified": profile.verified, "provider": info.model_dump()}


@router.get(
    "/{username}/protected",
    summary="Check if a user is protected",
)
async def get_profile_protected(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"protected": profile.protected, "provider": info.model_dump()}


@router.get(
    "/{username}/joined",
    summary="Get join date of a user",
)
async def get_profile_joined(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"joined_at": profile.joined_at, "provider": info.model_dump()}


@router.get(
    "/{username}/id",
    summary="Get internal ID of a user",
)
async def get_profile_id(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"id": profile.id, "provider": info.model_dump()}


@router.get(
    "/{username}/summary",
    summary="Get a short text summary of a profile",
)
async def get_profile_summary(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    lines = [
        f"{profile.display_name or profile.username} (@{profile.username})",
    ]
    if profile.verified:
        lines.append("Verified account")
    if profile.bio:
        lines.append(profile.bio)
    if profile.location:
        lines.append(f"Location: {profile.location}")
    if profile.website:
        lines.append(f"Website: {profile.website}")
    if profile.followers is not None:
        lines.append(f"Followers: {profile.followers:,}")
    if profile.following is not None:
        lines.append(f"Following: {profile.following:,}")
    if profile.tweets_count is not None:
        lines.append(f"Tweets: {profile.tweets_count:,}")
    return {"summary": "\n".join(lines), "provider": info.model_dump()}


@router.get(
    "/{username}/pinned",
    response_model=TweetListResponse,
    summary="Get the pinned tweet of a user",
)
async def get_profile_pinned(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not profile.pinned_tweet:
        raise HTTPException(status_code=404, detail="no pinned tweet")
    return TweetListResponse(
        data=[profile.pinned_tweet], provider=info, count=1
    )


@router.get(
    "/{username}/exists",
    summary="Check if a username exists",
)
async def get_profile_exists(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
        exists = profile is not None
    except ProviderError:
        exists = False
        info = None
    return {"exists": exists, "username": username, "provider": info.model_dump() if info else None}


@router.get(
    "/{username}/combined",
    summary="Get profile + recent tweets in one call",
)
async def get_profile_combined(
    username: str,
    tweet_limit: int = Query(10, ge=1, le=50),
):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    try:
        tweets, info2 = await registry.call_with_fallback(
            "get_user_tweets", username, limit=tweet_limit
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {
        "profile": profile.model_dump(),
        "tweets": [t.model_dump() for t in tweets],
        "provider": info2.model_dump(),
    }


@router.get(
    "/{username}/ratio",
    summary="Get follower/following ratio of a user",
)
async def get_profile_ratio(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    followers = profile.followers or 0
    following = profile.following or 0
    ratio = (followers / following) if following > 0 else None
    return {
        "ratio": round(ratio, 4) if ratio is not None else None,
        "followers": followers,
        "following": following,
        "provider": info.model_dump(),
    }


@router.get(
    "/{username}/influence-score",
    summary="Get a basic influence score for a user (0-100)",
)
async def get_profile_influence(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    f = profile.followers or 0
    fo = profile.following or 0
    t = profile.tweets_count or 0
    # naive weighted score
    score = min(100.0, (f * 0.0005) + (t * 0.001) + (10 if profile.verified else 0))
    return {
        "score": round(score, 2),
        "followers": f,
        "following": fo,
        "tweets": t,
        "verified": profile.verified,
        "provider": info.model_dump(),
    }


@router.get(
    "/bulk",
    summary="Get profiles for multiple users at once",
)
async def get_profiles_bulk(
    usernames: str = Query(..., description="Comma-separated usernames"),
):
    user_list = [u.strip() for u in usernames.split(",") if u.strip()][:20]
    results = []
    last_info = None
    for u in user_list:
        try:
            p, info = await registry.call_with_fallback("get_profile", u)
            results.append(p.model_dump())
            last_info = info
        except ProviderError:
            continue
    return {"data": results, "count": len(results), "provider": last_info.model_dump() if last_info else None}


@router.get(
    "/{username}/age",
    summary="Get account age in days",
)
async def get_profile_age(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not profile.joined_at:
        return {"age_days": None, "provider": info.model_dump()}
    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    age = (now - profile.joined_at).days
    return {"age_days": age, "joined_at": profile.joined_at.isoformat(), "provider": info.model_dump()}


@router.get(
    "/{username}/avatar-hd",
    summary="Get HD avatar URL (Twitter returns _400x400 by default; this returns original)",
)
async def get_profile_avatar_hd(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not profile.avatar:
        return {"avatar_hd": None, "provider": info.model_dump()}
    # Replace _normal with _bigger or remove size suffix for full-res
    hd_url = profile.avatar.replace("_normal.", ".").replace("_400x400.", ".")
    return {"avatar_hd": hd_url, "provider": info.model_dump()}


@router.get(
    "/{username}/banner-hd",
    summary="Get HD banner URL",
)
async def get_profile_banner_hd(username: str):
    try:
        profile, info = await registry.call_with_fallback("get_profile", username)
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    if not profile.banner:
        return {"banner_hd": None, "provider": info.model_dump()}
    # Twitter banner HD is /1500x500
    hd_url = profile.banner.replace("/600x200", "/1500x500") if "/600x200" in profile.banner else profile.banner
    return {"banner_hd": hd_url, "provider": info.model_dump()}

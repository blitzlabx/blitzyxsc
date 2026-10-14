"""Trends router — current trending topics.

Exposes ~15 trends endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..providers import registry
from ..providers.base import ProviderError
from ..schemas.models import TrendResponse

router = APIRouter(prefix="/trends", tags=["Trends"])


@router.get(
    "",
    response_model=TrendResponse,
    summary="Get current trends",
    description="Returns the current trending topics. Optional WOEID for geo-specific trends.",
)
async def get_trends(
    woeid: Optional[int] = Query(None, description="Yahoo Where On Earth ID"),
    location: Optional[str] = Query(None, description="Location name e.g. 'London'"),
):
    try:
        trends, info = await registry.call_with_fallback(
            "get_trends", woeid=woeid, location=location
        )
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    from datetime import datetime, timezone
    return TrendResponse(
        trends=trends,
        as_of=datetime.now(timezone.utc),
        provider=info,
    )


@router.get(
    "/global",
    response_model=TrendResponse,
    summary="Get global trends (woeid=1)",
)
async def get_trends_global():
    return await get_trends(woeid=1)


@router.get(
    "/worldwide",
    response_model=TrendResponse,
    summary="Alias of /trends/global",
)
async def get_trends_worldwide():
    return await get_trends(woeid=1)


@router.get(
    "/us",
    response_model=TrendResponse,
    summary="Get US trends (woeid=23424977)",
)
async def get_trends_us():
    return await get_trends(woeid=23424977)


@router.get(
    "/uk",
    response_model=TrendResponse,
    summary="Get UK trends (woeid=23424975)",
)
async def get_trends_uk():
    return await get_trends(woeid=23424975)


@router.get(
    "/japan",
    response_model=TrendResponse,
    summary="Get Japan trends (woeid=23424956)",
)
async def get_trends_japan():
    return await get_trends(woeid=23424956)


@router.get(
    "/india",
    response_model=TrendResponse,
    summary="Get India trends (woeid=23424848)",
)
async def get_trends_india():
    return await get_trends(woeid=23424848)


@router.get(
    "/brazil",
    response_model=TrendResponse,
    summary="Get Brazil trends (woeid=23424768)",
)
async def get_trends_brazil():
    return await get_trends(woeid=23424768)


@router.get(
    "/germany",
    response_model=TrendResponse,
    summary="Get Germany trends (woeid=23424829)",
)
async def get_trends_germany():
    return await get_trends(woeid=23424829)


@router.get(
    "/france",
    response_model=TrendResponse,
    summary="Get France trends (woeid=23424819)",
)
async def get_trends_france():
    return await get_trends(woeid=23424819)


@router.get(
    "/canada",
    response_model=TrendResponse,
    summary="Get Canada trends (woeid=23424775)",
)
async def get_trends_canada():
    return await get_trends(woeid=23424775)


@router.get(
    "/australia",
    response_model=TrendResponse,
    summary="Get Australia trends (woeid=23424748)",
)
async def get_trends_australia():
    return await get_trends(woeid=23424748)


@router.get(
    "/nigeria",
    response_model=TrendResponse,
    summary="Get Nigeria trends (woeid=23424908)",
)
async def get_trends_nigeria():
    return await get_trends(woeid=23424908)


@router.get(
    "/top/{n}",
    response_model=TrendResponse,
    summary="Get the top N trends",
)
async def get_trends_top_n(n: int):
    if n < 1 or n > 50:
        raise HTTPException(status_code=400, detail="n must be between 1 and 50")
    try:
        trends, info = await registry.call_with_fallback("get_trends")
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return TrendResponse(trends=trends[:n], provider=info)


@router.get(
    "/by-volume",
    response_model=TrendResponse,
    summary="Get trends sorted by tweet volume (descending)",
)
async def get_trends_by_volume():
    try:
        trends, info = await registry.call_with_fallback("get_trends")
    except ProviderError as e:
        raise HTTPException(status_code=502, detail=str(e))
    sorted_t = sorted(
        [t for t in trends if t.tweet_volume is not None],
        key=lambda t: t.tweet_volume,
        reverse=True,
    )
    return TrendResponse(trends=sorted_t, provider=info)

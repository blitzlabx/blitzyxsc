"""Unified schemas for blitzyxsc API responses across all providers."""
from __future__ import annotations

from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


class ProviderInfo(BaseModel):
    name: str
    latency_ms: Optional[float] = None
    ok: bool = True


class MediaItem(BaseModel):
    type: str = Field(..., description="photo | video | animated_gif")
    url: str
    alt: Optional[str] = None
    width: Optional[int] = None
    height: Optional[int] = None
    thumbnail: Optional[str] = None
    duration_ms: Optional[int] = None


class TweetAuthor(BaseModel):
    id: Optional[str] = None
    username: str
    display_name: Optional[str] = None
    avatar: Optional[str] = None
    verified: Optional[bool] = None


class Tweet(BaseModel):
    id: str
    text: str
    author: Optional[TweetAuthor] = None
    created_at: Optional[datetime] = None
    language: Optional[str] = None
    source: Optional[str] = None
    reply_count: Optional[int] = None
    retweet_count: Optional[int] = None
    like_count: Optional[int] = None
    quote_count: Optional[int] = None
    bookmark_count: Optional[int] = None
    view_count: Optional[int] = None
    media: List[MediaItem] = Field(default_factory=list)
    urls: List[str] = Field(default_factory=list)
    hashtags: List[str] = Field(default_factory=list)
    mentions: List[TweetAuthor] = Field(default_factory=list)
    cashtags: List[str] = Field(default_factory=list)
    conversation_id: Optional[str] = None
    in_reply_to: Optional[str] = None
    is_quote: Optional[bool] = None
    quoted_tweet: Optional["Tweet"] = None
    is_retweet: Optional[bool] = None
    retweeted_tweet: Optional["Tweet"] = None
    url: Optional[str] = None
    sensitive: Optional[bool] = None


Tweet.model_rebuild()


class Profile(BaseModel):
    id: Optional[str] = None
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None
    website: Optional[str] = None
    avatar: Optional[str] = None
    banner: Optional[str] = None
    followers: Optional[int] = None
    following: Optional[int] = None
    tweets_count: Optional[int] = None
    likes_count: Optional[int] = None
    listed_count: Optional[int] = None
    verified: Optional[bool] = None
    protected: Optional[bool] = None
    joined_at: Optional[datetime] = None
    pinned_tweet: Optional[Tweet] = None


class TrendLocation(BaseModel):
    name: str
    woeid: Optional[int] = None
    country: Optional[str] = None


class Trend(BaseModel):
    name: str
    url: Optional[str] = None
    promoted_content: Optional[bool] = None
    query: Optional[str] = None
    tweet_volume: Optional[int] = None
    rank: Optional[int] = None


class TrendResponse(BaseModel):
    trends: List[Trend]
    as_of: Optional[datetime] = None
    created_at: Optional[datetime] = None
    locations: List[TrendLocation] = Field(default_factory=list)
    provider: Optional[ProviderInfo] = None


class TweetListResponse(BaseModel):
    data: List[Tweet]
    provider: ProviderInfo
    count: int
    next_cursor: Optional[str] = None
    previous_cursor: Optional[str] = None


class ProfileResponse(BaseModel):
    data: Profile
    provider: ProviderInfo


class TweetResponse(BaseModel):
    data: Tweet
    provider: ProviderInfo


class ErrorResponse(BaseModel):
    error: str
    detail: Optional[Any] = None
    provider: Optional[ProviderInfo] = None


class HealthResponse(BaseModel):
    status: str
    brand: str
    version: str
    author: str
    providers: List[str]
    uptime_seconds: float


class ProviderListResponse(BaseModel):
    providers: List[dict]
    order: List[str]

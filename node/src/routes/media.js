/**
 * Media router — extract images, videos, GIFs from tweets/users.
 *
 * Mirrors `blitzyxsc_api/routers/media.py`. Mounted under `/media`.
 */

import express from "express";
import { tweetListResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery, notFound, strQuery } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

// ---- /media/tweet/:tweet_id -----------------------------------------------

router.get(
  "/tweet/:tweet_id",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ data: tweet.media, provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/photos",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ data: tweet.media.filter((m) => m.type === "photo"), provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/videos",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ data: tweet.media.filter((m) => m.type === "video"), provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/gifs",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ data: tweet.media.filter((m) => m.type === "animated_gif"), provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/first-photo",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    const photos = tweet.media.filter((m) => m.type === "photo");
    if (!photos.length) return notFound(res, "no photos in tweet");
    res.json({ url: photos[0].url, provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/first-video",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    const videos = tweet.media.filter((m) => m.type === "video" || m.type === "animated_gif");
    if (!videos.length) return notFound(res, "no videos in tweet");
    res.json({ url: videos[0].url, type: videos[0].type, provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/thumbnails",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    const thumbs = tweet.media.map((m) => ({ thumbnail: m.thumbnail || m.url, type: m.type }));
    res.json({ data: thumbs, provider: providerInfo });
  }),
);

router.get(
  "/tweet/:tweet_id/count",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    const counts = {
      total: tweet.media.length,
      photos: tweet.media.filter((m) => m.type === "photo").length,
      videos: tweet.media.filter((m) => m.type === "video").length,
      gifs: tweet.media.filter((m) => m.type === "animated_gif").length,
    };
    res.json({ data: counts, provider: providerInfo });
  }),
);

// ---- /media/user/:username ------------------------------------------------

router.get(
  "/user/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 2,
    );
    const filtered = tweets.filter((t) => t.media && t.media.length > 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/photos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "photo")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/videos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "video")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/all-photos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const photos = [];
    for (const t of tweets) {
      for (const m of t.media) {
        if (m.type === "photo") {
          photos.push({ url: m.url, tweet_id: t.id, alt: m.alt });
        }
      }
    }
    res.json({ data: photos.slice(0, limit * 4), count: photos.length, provider: providerInfo });
  }),
);

router.get(
  "/user/:username/all-videos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const videos = [];
    for (const t of tweets) {
      for (const m of t.media) {
        if (m.type === "video" || m.type === "animated_gif") {
          videos.push({ url: m.url, type: m.type, tweet_id: t.id, duration_ms: m.duration_ms });
        }
      }
    }
    res.json({ data: videos.slice(0, limit * 4), count: videos.length, provider: providerInfo });
  }),
);

router.get(
  "/user/:username/avatar",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ avatar: profile.avatar, provider: providerInfo });
  }),
);

router.get(
  "/user/:username/banner",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ banner: profile.banner, provider: providerInfo });
  }),
);

router.get(
  "/user/:username/avatar-hd",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    if (!profile.avatar) return res.json({ avatar_hd: null, provider: providerInfo });
    const hdUrl = profile.avatar.replace("_normal.", ".").replace("_400x400.", ".");
    res.json({ avatar_hd: hdUrl, provider: providerInfo });
  }),
);

router.get(
  "/user/:username/most-viewed",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 10, { min: 1, max: 50 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      100,
    );
    const mediaTweets = tweets.filter((t) => t.media && t.media.length > 0);
    const sorted = mediaTweets.sort((a, b) => (b.view_count || 0) - (a.view_count || 0));
    res.json(tweetListResponse(sorted.slice(0, limit), providerInfo));
  }),
);

router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const type = (strQuery(req, "type") || "all").toLowerCase();
    const typeFilter =
      { photo: "filter:images", video: "filter:videos", gif: "filter:twimg" }[type] || "";
    const fullQ = typeFilter ? `${q} ${typeFilter}` : q;
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("search_tweets", fullQ, limit, null, "latest", null);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

export default router;

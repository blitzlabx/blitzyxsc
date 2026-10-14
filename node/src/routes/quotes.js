/**
 * Quotes router — quote tweets (tweets that quote another tweet).
 *
 * Mirrors `blitzyxsc_api/routers/quotes.py`. Mounted under `/quotes`.
 */

import express from "express";
import { settings } from "../lib/config.js";
import { tweetListResponse, tweetResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery, notFound } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

router.get(
  "/:tweet_id",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", settings.defaultPageSize, { min: 1, max: settings.maxPageSize });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/:tweet_id/latest",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/:tweet_id/top",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const minLikes = intQuery(req, "min_likes", 0, { min: 0 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, 200);
    const filtered = tweets
      .filter((t) => (t.like_count || 0) >= minLikes)
      .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/by-verified",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets.filter((t) => t.author && t.author.verified).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/with-media",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets.filter((t) => t.media && t.media.length > 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/with-photos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "photo")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/with-videos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "video")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/positive",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets
      .filter((t) => /great|love|amazing|good|nice/i.test(t.text))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/negative",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets
      .filter((t) => /bad|terrible|hate|awful|worst/i.test(t.text))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/by-lang/:lang",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets.filter((t) => t.language === req.params.lang).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/count",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ quote_count: tweet.quote_count, provider: providerInfo });
  }),
);

router.get(
  "/:tweet_id/since/:since",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const sinceTs = Date.parse(req.params.since);
    if (Number.isNaN(sinceTs)) {
      return res.status(400).json({ error: "invalid since date (use YYYY-MM-DD)" });
    }
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets
      .filter((t) => t.created_at && Date.parse(t.created_at) >= sinceTs)
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/until/:until",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const untilTs = Date.parse(req.params.until);
    if (Number.isNaN(untilTs)) {
      return res.status(400).json({ error: "invalid until date (use YYYY-MM-DD)" });
    }
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit * 3);
    const filtered = tweets
      .filter((t) => t.created_at && Date.parse(t.created_at) <= untilTs)
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/oldest",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, 200);
    const filtered = tweets
      .filter((t) => t.created_at)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    res.json(tweetListResponse(filtered.slice(0, limit), providerInfo));
  }),
);

router.get(
  "/:tweet_id/context",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.quoted_tweet) return notFound(res, "tweet has no quote");
    res.json(tweetResponse(tweet.quoted_tweet, providerInfo));
  }),
);

export default router;

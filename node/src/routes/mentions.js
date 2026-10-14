/**
 * Mentions router — find tweets mentioning a user.
 *
 * Mirrors `blitzyxsc_api/routers/mentions.py`. Mounted under `/mentions`.
 */

import express from "express";
import { settings } from "../lib/config.js";
import { tweetListResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery, strQuery } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", settings.defaultPageSize, { min: 1, max: settings.maxPageSize });
    const cursor = strQuery(req, "cursor") || null;
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit, cursor);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/:username/latest",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/:username/top",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const minLikes = intQuery(req, "min_likes", 0, { min: 0 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, 200);
    const filtered = tweets
      .filter((t) => (t.like_count || 0) >= minLikes)
      .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/from-verified",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.author && t.author.verified).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/with-media",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.media && t.media.length > 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/with-photos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "photo")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/with-videos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.media.some((m) => m.type === "video")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/with-links",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.urls && t.urls.length > 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/by-lang/:lang",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.language === req.params.lang).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/since/:since",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const sinceTs = Date.parse(req.params.since);
    if (Number.isNaN(sinceTs)) {
      return res.status(400).json({ error: "invalid since date (use YYYY-MM-DD)" });
    }
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets
      .filter((t) => t.created_at && Date.parse(t.created_at) >= sinceTs)
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/until/:until",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const untilTs = Date.parse(req.params.until);
    if (Number.isNaN(untilTs)) {
      return res.status(400).json({ error: "invalid until date (use YYYY-MM-DD)" });
    }
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets
      .filter((t) => t.created_at && Date.parse(t.created_at) <= untilTs)
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/questions",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets.filter((t) => t.text.includes("?")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/positive",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets
      .filter((t) => /thanks|great|love|amazing|good/i.test(t.text))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/negative",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, limit * 3);
    const filtered = tweets
      .filter((t) => /bad|terrible|hate|awful|worst/i.test(t.text))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:username/count",
  asyncHandler(async (req, res) => {
    const { result: tweets, providerInfo } = await callWithFallback("get_mentions", req.params.username, 100);
    res.json({ count: tweets.length, provider: providerInfo });
  }),
);

export default router;

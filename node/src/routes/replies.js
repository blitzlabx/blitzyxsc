/**
 * Replies & comments router — conversation threads, reply trees.
 *
 * Mirrors `blitzyxsc_api/routers/replies.py`. Mounted under `/replies`.
 */

import express from "express";
import { settings } from "../lib/config.js";
import { tweetListResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery } from "../lib/http.js";
import { ProviderError, callWithFallback } from "../providers/index.js";

export const router = express.Router();

router.get(
  "/:tweet_id",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", settings.defaultPageSize, { min: 1, max: settings.maxPageSize });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit);
    res.json(tweetListResponse(replies, providerInfo));
  }),
);

router.get(
  "/:tweet_id/latest",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit);
    res.json(tweetListResponse(replies, providerInfo));
  }),
);

router.get(
  "/:tweet_id/tree",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 50, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit);
    res.json(tweetListResponse(replies, providerInfo));
  }),
);

router.get(
  "/:tweet_id/count",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ reply_count: tweet.reply_count, provider: providerInfo });
  }),
);

router.get(
  "/:tweet_id/by-verified",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit * 2);
    const filtered = replies.filter((r) => r.author && r.author.verified).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/by-author",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweet } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.author) return res.status(404).json({ error: "no author found for tweet" });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit * 3);
    const filtered = replies
      .filter((r) => r.author && r.author.username.toLowerCase() === tweet.author.username.toLowerCase())
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/with-media",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit * 3);
    const filtered = replies.filter((r) => r.media && r.media.length > 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/with-photos",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, limit * 3);
    const filtered = replies.filter((r) => r.media.some((m) => m.type === "photo")).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/popular",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const minLikes = intQuery(req, "min_likes", 0, { min: 0 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, 200);
    const filtered = replies
      .filter((r) => (r.like_count || 0) >= minLikes)
      .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/controversial",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: replies, providerInfo } = await callWithFallback("get_replies", req.params.tweet_id, 200);
    const filtered = replies
      .sort((a, b) => (b.reply_count || 0) + (b.retweet_count || 0) - ((a.reply_count || 0) + (a.retweet_count || 0)))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/:tweet_id/thread",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 50, { min: 1, max: 100 });
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.conversation_id) {
      return res.json(tweetListResponse([tweet], providerInfo, 1));
    }
    let replies = [];
    let info = providerInfo;
    try {
      const r = await callWithFallback("get_replies", tweet.conversation_id, limit);
      replies = r.result;
      info = r.providerInfo;
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
    }
    const thread = tweet.author
      ? replies.filter((r) => r.author && r.author.username === tweet.author.username)
      : replies;
    res.json(tweetListResponse(thread, info));
  }),
);

router.get(
  "/:tweet_id/quoted",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("get_quotes", req.params.tweet_id, limit);
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/:tweet_id/context",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    let parent = null;
    if (tweet.in_reply_to) {
      try {
        const r = await callWithFallback("get_tweet", tweet.in_reply_to);
        parent = r.result;
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
      }
    }
    let replies = [];
    let info = providerInfo;
    try {
      const r = await callWithFallback("get_replies", req.params.tweet_id, limit);
      replies = r.result;
      info = r.providerInfo;
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
    }
    const data = [];
    if (parent) data.push(parent);
    data.push(tweet);
    data.push(...replies);
    res.json(tweetListResponse(data, info));
  }),
);

router.get(
  "/:tweet_id/conversation-id",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ conversation_id: tweet.conversation_id, provider: providerInfo });
  }),
);

router.get(
  "/:tweet_id/root",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    const visited = new Set();
    let current = tweet;
    while (current && current.in_reply_to && !visited.has(current.in_reply_to)) {
      visited.add(current.in_reply_to);
      try {
        const r = await callWithFallback("get_tweet", current.in_reply_to);
        current = r.result;
      } catch (e) {
        if (!(e instanceof ProviderError)) throw e;
        break;
      }
    }
    res.json(tweetListResponse([current], providerInfo, 1));
  }),
);

export default router;

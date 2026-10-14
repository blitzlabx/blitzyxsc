/**
 * Posts router — single tweet, user timeline, list, with many filter variants.
 *
 * Mirrors `blitzyxsc_api/routers/posts.py`. All routes are mounted under
 * `/posts` in `src/server.js`.
 */

import express from "express";
import { settings } from "../lib/config.js";
import { tweetListResponse, tweetResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery, notFound, strQuery } from "../lib/http.js";
import { ProviderError, callWithFallback } from "../providers/index.js";

export const router = express.Router();

// ---- static-path routes (registered before /:tweet_id to avoid the dynamic
//      param swallowing them) ----------------------------------------------

router.get(
  "/ids",
  asyncHandler(async (req, res) => {
    const idsParam = strQuery(req, "ids");
    if (!idsParam) return res.status(400).json({ error: "missing ids query param" });
    const idsList = idsParam.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 50);
    const results = [];
    let lastInfo = null;
    for (const tid of idsList) {
      try {
        const { result, providerInfo } = await callWithFallback("get_tweet", tid);
        results.push(result);
        lastInfo = providerInfo;
      } catch {
        // skip failed IDs
      }
    }
    res.json(
      tweetListResponse(results, lastInfo || { name: "multi", ok: results.length > 0, latency_ms: null }),
    );
  }),
);

router.get(
  "/by-date",
  asyncHandler(async (req, res) => {
    const username = strQuery(req, "username");
    const since = strQuery(req, "since");
    const until = strQuery(req, "until");
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    if (!username || !since || !until) {
      return res.status(400).json({ error: "username, since, until are required" });
    }
    const sinceTs = Date.parse(since);
    const untilTs = Date.parse(until);
    if (Number.isNaN(sinceTs) || Number.isNaN(untilTs)) {
      return res.status(400).json({ error: "invalid date format (use YYYY-MM-DD)" });
    }
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      username,
      limit * 3,
    );
    const filtered = tweets
      .filter((t) => {
        if (!t.created_at) return false;
        const ts = Date.parse(t.created_at);
        return ts >= sinceTs && ts <= untilTs;
      })
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/by-language",
  asyncHandler(async (req, res) => {
    const username = strQuery(req, "username");
    const lang = strQuery(req, "lang");
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    if (!username || !lang) {
      return res.status(400).json({ error: "username and lang are required" });
    }
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      username,
      limit * 3,
    );
    const filtered = tweets.filter((t) => t.language === lang).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/by-hashtag",
  asyncHandler(async (req, res) => {
    const username = strQuery(req, "username");
    const hashtag = strQuery(req, "hashtag");
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    if (!username || !hashtag) {
      return res.status(400).json({ error: "username and hashtag are required" });
    }
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      username,
      limit * 3,
    );
    const filtered = tweets
      .filter((t) => t.hashtags.some((h) => h.toLowerCase() === hashtag.toLowerCase()))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

// ---- user timeline + filtered variants ----------------------------------

router.get(
  "/user/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", settings.defaultPageSize, { min: 1, max: settings.maxPageSize });
    const cursor = strQuery(req, "cursor") || null;
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit,
      cursor,
    );
    res.json(tweetListResponse(tweets, providerInfo));
  }),
);

router.get(
  "/user/:username/media",
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
    const filtered = tweets
      .filter((t) => t.media.some((m) => m.type === "photo"))
      .slice(0, limit);
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
    const filtered = tweets
      .filter((t) => t.media.some((m) => m.type === "video"))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/replies",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 2,
    );
    const filtered = tweets.filter((t) => t.in_reply_to !== null && t.in_reply_to !== undefined).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/original",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 2,
    );
    const filtered = tweets
      .filter((t) => (t.in_reply_to === null || t.in_reply_to === undefined) && !t.is_retweet)
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/retweets",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const filtered = tweets.filter((t) => t.is_retweet).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/quotes",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 3,
    );
    const filtered = tweets.filter((t) => t.is_quote).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/user/:username/text-only",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      limit * 2,
    );
    const filtered = tweets.filter((t) => !t.media || t.media.length === 0).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

// ---- /posts/id/:tweet_id sub-resources ------------------------------------

router.get(
  "/id/:tweet_id/stats",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({
      data: {
        id: tweet.id,
        reply_count: tweet.reply_count,
        retweet_count: tweet.retweet_count,
        like_count: tweet.like_count,
        quote_count: tweet.quote_count,
        view_count: tweet.view_count,
        bookmark_count: tweet.bookmark_count,
      },
      provider: providerInfo,
    });
  }),
);

router.get(
  "/id/:tweet_id/text",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ text: tweet.text, id: tweet.id, provider: providerInfo });
  }),
);

router.get(
  "/id/:tweet_id/hashtags",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ hashtags: tweet.hashtags, provider: providerInfo });
  }),
);

router.get(
  "/id/:tweet_id/mentions",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ mentions: tweet.mentions, provider: providerInfo });
  }),
);

router.get(
  "/id/:tweet_id/urls",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    res.json({ urls: tweet.urls, provider: providerInfo });
  }),
);

router.get(
  "/id/:tweet_id/author",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.author) return notFound(res, "no author");
    res.json({ data: tweet.author, provider: providerInfo });
  }),
);

router.get(
  "/id/:tweet_id/quoted",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.quoted_tweet) return notFound(res, "tweet has no quote");
    res.json(tweetResponse(tweet.quoted_tweet, providerInfo));
  }),
);

router.get(
  "/id/:tweet_id/conversation",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet.conversation_id) {
      return res.json(tweetListResponse([tweet], providerInfo));
    }
    let replies = [];
    let info = providerInfo;
    try {
      const r = await callWithFallback("get_replies", tweet.conversation_id, limit);
      replies = r.result;
      info = r.providerInfo;
    } catch (e) {
      if (!(e instanceof ProviderError)) throw e;
      // fall through with empty replies
    }
    const all = [tweet, ...replies];
    res.json(tweetListResponse(all, info));
  }),
);

// ---- popular-by-user (must come before /:tweet_id so the dynamic param
//      doesn't swallow it; /popular/:username is 2 segments so it's safe,
//      but register explicitly for clarity) -----------------------------------

router.get(
  "/popular/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const minLikes = intQuery(req, "min_likes", 100, { min: 0 });
    const { result: tweets, providerInfo } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      200,
    );
    const filtered = tweets
      .filter((t) => (t.like_count || 0) >= minLikes)
      .sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
      .slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

// ---- single-tweet lookup (registered LAST so static paths above win) -------

router.get(
  "/:tweet_id",
  asyncHandler(async (req, res) => {
    const { result: tweet, providerInfo } = await callWithFallback("get_tweet", req.params.tweet_id);
    if (!tweet) return notFound(res, `Tweet ${req.params.tweet_id} not found`);
    res.json(tweetResponse(tweet, providerInfo));
  }),
);

export default router;

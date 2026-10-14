/**
 * Search router — keyword search, advanced search, filtered variants.
 *
 * Mirrors `blitzyxsc_api/routers/search.py`. Mounted under `/search`.
 */

import express from "express";
import { settings } from "../lib/config.js";
import { tweetListResponse } from "../lib/schemas.js";
import { asyncHandler, intQuery, strQuery } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

/**
 * Build a Twitter advanced-search query string from structured filters.
 *
 * @param {string} q
 * @param {Record<string, any>} filters
 * @returns {string}
 */
function buildQuery(q, filters) {
  if (!filters) return q;
  const parts = [q];
  for (const [k, v] of Object.entries(filters)) {
    if (v === null || v === undefined || v === "") continue;
    if (k === "from_user") parts.push(`from:${v}`);
    else if (k === "to_user") parts.push(`to:${v}`);
    else if (k === "since") parts.push(`since:${v}`);
    else if (k === "until") parts.push(`until:${v}`);
    else if (k === "min_faves") parts.push(`min_faves:${v}`);
    else if (k === "min_retweets") parts.push(`min_retweets:${v}`);
    else if (k === "min_replies") parts.push(`min_replies:${v}`);
    else if (k === "lang") parts.push(`lang:${v}`);
    else if (k === "geocode") parts.push(`geocode:${v}`);
    else if (k === "near") parts.push(`near:${v}`);
    else if (k === "within") parts.push(`within:${v}`);
    else if (k === "filter_images" && v) parts.push("filter:images");
    else if (k === "filter_videos" && v) parts.push("filter:videos");
    else if (k === "filter_news" && v) parts.push("filter:news");
    else if (k === "exclude_retweets" && v) parts.push("-filter:retweets");
    else if (k === "exclude_replies" && v) parts.push("-filter:replies");
  }
  return parts.join(" ");
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {string} q
 * @param {number} limit
 * @param {string} [sort]
 */
async function searchAndRespond(req, res, q, limit, sort) {
  const cursor = strQuery(req, "cursor") || null;
  const { result: tweets, providerInfo } = await callWithFallback(
    "search_tweets",
    q,
    limit,
    cursor,
    sort || "latest",
    null,
  );
  res.json(tweetListResponse(tweets, providerInfo));
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", settings.defaultPageSize, { min: 1, max: settings.maxPageSize });
    await searchAndRespond(req, res, q, limit);
  }),
);

router.get(
  "/latest",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, q, limit, "latest");
  }),
);

router.get(
  "/top",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("search_tweets", q, limit, null, "top");
    const sorted = tweets
      .sort((a, b) => (b.like_count || 0) + (b.retweet_count || 0) - ((a.like_count || 0) + (a.retweet_count || 0)))
      .slice(0, limit);
    res.json(tweetListResponse(sorted, providerInfo));
  }),
);

router.get(
  "/advanced",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const filters = {
      from_user: strQuery(req, "from_user"),
      to_user: strQuery(req, "to_user"),
      since: strQuery(req, "since"),
      until: strQuery(req, "until"),
      min_faves: intQuery(req, "min_faves", null),
      min_retweets: intQuery(req, "min_retweets", null),
      min_replies: intQuery(req, "min_replies", null),
      lang: strQuery(req, "lang"),
      geocode: strQuery(req, "geocode"),
      near: strQuery(req, "near"),
      within: strQuery(req, "within"),
      filter_images: ["1", "true", "yes"].includes(String(req.query.filter_images || "").toLowerCase()),
      filter_videos: ["1", "true", "yes"].includes(String(req.query.filter_videos || "").toLowerCase()),
      filter_news: ["1", "true", "yes"].includes(String(req.query.filter_news || "").toLowerCase()),
      exclude_retweets: ["1", "true", "yes"].includes(String(req.query.exclude_retweets || "").toLowerCase()),
      exclude_replies: ["1", "true", "yes"].includes(String(req.query.exclude_replies || "").toLowerCase()),
    };
    const fullQ = buildQuery(q, filters);
    await searchAndRespond(req, res, fullQ, limit, "latest");
  }),
);

router.get(
  "/photos",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} filter:images`, limit);
  }),
);

router.get(
  "/videos",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} filter:videos`, limit);
  }),
);

router.get(
  "/news",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} filter:news`, limit);
  }),
);

router.get(
  "/hashtag/:hashtag",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `#${req.params.hashtag}`, limit);
  }),
);

router.get(
  "/cashtag/:cashtag",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `$${req.params.cashtag}`, limit);
  }),
);

router.get(
  "/mention/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `@${req.params.username}`, limit);
  }),
);

router.get(
  "/from/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `from:${req.params.username}`, limit);
  }),
);

router.get(
  "/to/:username",
  asyncHandler(async (req, res) => {
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `to:${req.params.username}`, limit);
  }),
);

router.get(
  "/since/:date",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} since:${req.params.date}`, limit);
  }),
);

router.get(
  "/until/:date",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} until:${req.params.date}`, limit);
  }),
);

router.get(
  "/lang/:lang",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} lang:${req.params.lang}`, limit);
  }),
);

router.get(
  "/min-faves/:min_faves",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} min_faves:${req.params.min_faves}`, limit);
  }),
);

router.get(
  "/min-retweets/:min_retweets",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} min_retweets:${req.params.min_retweets}`, limit);
  }),
);

router.get(
  "/near/:place",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const within = strQuery(req, "within", "15mi");
    await searchAndRespond(req, res, `${q} near:${req.params.place} within:${within}`, limit);
  }),
);

router.get(
  "/verified",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} filter:verified`, limit);
  }),
);

router.get(
  "/no-retweets",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} -filter:retweets`, limit);
  }),
);

router.get(
  "/no-replies",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} -filter:replies`, limit);
  }),
);

router.get(
  "/safe",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    const { result: tweets, providerInfo } = await callWithFallback("search_tweets", q, limit * 2, null, "latest", null);
    const filtered = tweets.filter((t) => !t.sensitive).slice(0, limit);
    res.json(tweetListResponse(filtered, providerInfo));
  }),
);

router.get(
  "/original",
  asyncHandler(async (req, res) => {
    const q = strQuery(req, "q");
    if (!q) return res.status(400).json({ error: "missing q query param" });
    const limit = intQuery(req, "limit", 20, { min: 1, max: 100 });
    await searchAndRespond(req, res, `${q} -filter:retweets -filter:replies`, limit);
  }),
);

export default router;

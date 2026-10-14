/**
 * Trends router — current trending topics.
 *
 * Mirrors `blitzyxsc_api/routers/trends.py`. Mounted under `/trends`.
 *
 * Note: trend endpoints rely on the Nitter `/trends` page; if every Nitter
 * instance is down, the request falls back through the registry and returns
 * a 502 with a clear error message.
 */

import express from "express";
import { asyncHandler, intQuery } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

async function getTrendsFor(res, woeid, location) {
  const { result: trends, providerInfo } = await callWithFallback("get_trends", woeid ?? null, location ?? null);
  return res.json({
    trends,
    as_of: new Date().toISOString(),
    created_at: null,
    locations: [],
    provider: providerInfo,
  });
}

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const woeid = intQuery(req, "woeid", null);
    const location = req.query.location ? String(req.query.location) : null;
    await getTrendsFor(res, woeid, location);
  }),
);

router.get("/global", asyncHandler(async (req, res) => getTrendsFor(res, 1, null)));
router.get("/worldwide", asyncHandler(async (req, res) => getTrendsFor(res, 1, null)));
router.get("/us", asyncHandler(async (req, res) => getTrendsFor(res, 23424977, null)));
router.get("/uk", asyncHandler(async (req, res) => getTrendsFor(res, 23424975, null)));
router.get("/japan", asyncHandler(async (req, res) => getTrendsFor(res, 23424956, null)));
router.get("/india", asyncHandler(async (req, res) => getTrendsFor(res, 23424848, null)));
router.get("/brazil", asyncHandler(async (req, res) => getTrendsFor(res, 23424768, null)));
router.get("/germany", asyncHandler(async (req, res) => getTrendsFor(res, 23424829, null)));
router.get("/france", asyncHandler(async (req, res) => getTrendsFor(res, 23424819, null)));
router.get("/canada", asyncHandler(async (req, res) => getTrendsFor(res, 23424775, null)));
router.get("/australia", asyncHandler(async (req, res) => getTrendsFor(res, 23424748, null)));
router.get("/nigeria", asyncHandler(async (req, res) => getTrendsFor(res, 23424908, null)));

router.get(
  "/top/:n",
  asyncHandler(async (req, res) => {
    const n = parseInt(req.params.n, 10);
    if (!Number.isFinite(n) || n < 1 || n > 50) {
      return res.status(400).json({ error: "n must be between 1 and 50" });
    }
    const { result: trends, providerInfo } = await callWithFallback("get_trends");
    res.json({
      trends: trends.slice(0, n),
      as_of: new Date().toISOString(),
      created_at: null,
      locations: [],
      provider: providerInfo,
    });
  }),
);

router.get(
  "/by-volume",
  asyncHandler(async (req, res) => {
    const { result: trends, providerInfo } = await callWithFallback("get_trends");
    const sorted = trends
      .filter((t) => t.tweet_volume !== null && t.tweet_volume !== undefined)
      .sort((a, b) => (b.tweet_volume || 0) - (a.tweet_volume || 0));
    res.json({
      trends: sorted,
      as_of: new Date().toISOString(),
      created_at: null,
      locations: [],
      provider: providerInfo,
    });
  }),
);

export default router;

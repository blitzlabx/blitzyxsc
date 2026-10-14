/**
 * Profile router — user profile lookups and variations.
 *
 * Mirrors `blitzyxsc_api/routers/profile.py`. Mounted under `/profile`.
 */

import express from "express";
import { tweetListResponse } from "../lib/schemas.js";
import { asyncHandler, badRequest, notFound, strQuery } from "../lib/http.js";
import { callWithFallback } from "../providers/index.js";

export const router = express.Router();

// NOTE: `/profile/bulk` must be registered before `/:username` to avoid the
// dynamic param swallowing it.
router.get(
  "/bulk",
  asyncHandler(async (req, res) => {
    const usernamesParam = strQuery(req, "usernames");
    if (!usernamesParam) {
      return badRequest(res, "missing usernames query param");
    }
    const userlist = usernamesParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
    const results = [];
    let lastInfo = null;
    for (const u of userlist) {
      try {
        const { result, providerInfo } = await callWithFallback("get_profile", u);
        results.push(result);
        lastInfo = providerInfo;
      } catch {
        // skip failed usernames
      }
    }
    res.json({ data: results, count: results.length, provider: lastInfo });
  }),
);

router.get(
  "/:username",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ data: profile, provider: providerInfo });
  }),
);

router.get(
  "/:username/bio",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ bio: profile.bio, provider: providerInfo });
  }),
);

router.get(
  "/:username/avatar",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ avatar: profile.avatar, provider: providerInfo });
  }),
);

router.get(
  "/:username/banner",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ banner: profile.banner, provider: providerInfo });
  }),
);

router.get(
  "/:username/display-name",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ display_name: profile.display_name, provider: providerInfo });
  }),
);

router.get(
  "/:username/location",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ location: profile.location, provider: providerInfo });
  }),
);

router.get(
  "/:username/website",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ website: profile.website, provider: providerInfo });
  }),
);

router.get(
  "/:username/stats",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({
      data: {
        followers: profile.followers,
        following: profile.following,
        tweets_count: profile.tweets_count,
        likes_count: profile.likes_count,
        listed_count: profile.listed_count,
      },
      provider: providerInfo,
    });
  }),
);

router.get(
  "/:username/followers",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ followers: profile.followers, provider: providerInfo });
  }),
);

router.get(
  "/:username/following",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ following: profile.following, provider: providerInfo });
  }),
);

router.get(
  "/:username/verified",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ verified: profile.verified, provider: providerInfo });
  }),
);

router.get(
  "/:username/protected",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ protected: profile.protected, provider: providerInfo });
  }),
);

router.get(
  "/:username/joined",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ joined_at: profile.joined_at, provider: providerInfo });
  }),
);

router.get(
  "/:username/id",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    res.json({ id: profile.id, provider: providerInfo });
  }),
);

router.get(
  "/:username/summary",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    const lines = [
      `${profile.display_name || profile.username} (@${profile.username})`,
    ];
    if (profile.verified) lines.push("Verified account");
    if (profile.bio) lines.push(profile.bio);
    if (profile.location) lines.push(`Location: ${profile.location}`);
    if (profile.website) lines.push(`Website: ${profile.website}`);
    if (profile.followers !== null && profile.followers !== undefined) {
      lines.push(`Followers: ${profile.followers.toLocaleString()}`);
    }
    if (profile.following !== null && profile.following !== undefined) {
      lines.push(`Following: ${profile.following.toLocaleString()}`);
    }
    if (profile.tweets_count !== null && profile.tweets_count !== undefined) {
      lines.push(`Tweets: ${profile.tweets_count.toLocaleString()}`);
    }
    res.json({ summary: lines.join("\n"), provider: providerInfo });
  }),
);

router.get(
  "/:username/ratio",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    const followers = profile.followers || 0;
    const following = profile.following || 0;
    const ratio = following > 0 ? followers / following : null;
    res.json({
      ratio: ratio !== null ? Math.round(ratio * 10000) / 10000 : null,
      followers,
      following,
      provider: providerInfo,
    });
  }),
);

router.get(
  "/:username/influence-score",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    const f = profile.followers || 0;
    const fo = profile.following || 0;
    const t = profile.tweets_count || 0;
    const score = Math.min(100.0, f * 0.0005 + t * 0.001 + (profile.verified ? 10 : 0));
    res.json({
      score: Math.round(score * 100) / 100,
      followers: f,
      following: fo,
      tweets: t,
      verified: profile.verified,
      provider: providerInfo,
    });
  }),
);

router.get(
  "/:username/combined",
  asyncHandler(async (req, res) => {
    const tweetLimit = Math.min(50, Math.max(1, parseInt(String(req.query.tweet_limit || "10"), 10) || 10));
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    const { result: tweets, providerInfo: info2 } = await callWithFallback(
      "get_user_tweets",
      req.params.username,
      tweetLimit,
    );
    res.json({
      profile,
      tweets,
      provider: info2 || providerInfo,
    });
  }),
);

router.get(
  "/:username/exists",
  asyncHandler(async (req, res) => {
    let exists = false;
    let info = null;
    try {
      const r = await callWithFallback("get_profile", req.params.username);
      exists = !!r.result;
      info = r.providerInfo;
    } catch {
      exists = false;
    }
    res.json({ exists, username: req.params.username, provider: info });
  }),
);

router.get(
  "/:username/avatar-hd",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    if (!profile.avatar) return res.json({ avatar_hd: null, provider: providerInfo });
    const hdUrl = profile.avatar.replace("_normal.", ".").replace("_400x400.", ".");
    res.json({ avatar_hd: hdUrl, provider: providerInfo });
  }),
);

router.get(
  "/:username/banner-hd",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    if (!profile.banner) return res.json({ banner_hd: null, provider: providerInfo });
    const hdUrl = profile.banner.includes("/600x200")
      ? profile.banner.replace("/600x200", "/1500x500")
      : profile.banner;
    res.json({ banner_hd: hdUrl, provider: providerInfo });
  }),
);

router.get(
  "/:username/pinned",
  asyncHandler(async (req, res) => {
    const { result: profile, providerInfo } = await callWithFallback("get_profile", req.params.username);
    if (!profile.pinned_tweet) return notFound(res, "no pinned tweet");
    res.json(tweetListResponse([profile.pinned_tweet], providerInfo, 1));
  }),
);

export default router;

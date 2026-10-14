/**
 * Meta router — root, health, providers, playground.
 *
 * Mirrors the inline meta endpoints in `blitzyxsc_api/main.py` and exposes
 * them as an Express router mounted at the application root.
 */

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { AUTHOR, AUTHOR_HANDLE, AUTHOR_URL, BRAND, VERSION } from "../lib/config.js";
import { healthResponse, providerListResponse } from "../lib/schemas.js";
import { registry } from "../providers/index.js";

export const router = express.Router();

const START_TIME = Date.now();

// Root landing page — branded HTML mirroring the FastAPI root handler.
router.get("/", (_req, res) => {
  res.type("html").send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${BRAND}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 0; background: #0a0a0a; color: #fff; }
  .container { max-width: 800px; margin: 0 auto; padding: 80px 24px; text-align: center; }
  h1 { font-size: 64px; margin: 0 0 12px; background: linear-gradient(90deg, #1DA1F2, #8B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .tagline { font-size: 20px; color: #aaa; margin-bottom: 32px; }
  .btn { display: inline-block; padding: 12px 24px; background: #1DA1F2; color: #fff !important; text-decoration: none; border-radius: 8px; margin: 4px; font-weight: 600; }
  .btn.secondary { background: transparent; border: 1px solid #333; }
  .meta { margin-top: 60px; color: #666; font-size: 14px; }
  .meta a { color: #1DA1F2; }
</style>
</head>
<body>
<div class="container">
<h1>${BRAND}</h1>
<p class="tagline">Auth-free X/Twitter scraping API · Node.js / Express</p>
<a href="/health" class="btn">Health</a>
<a href="/providers" class="btn secondary">Providers</a>
<a href="/providers/health" class="btn secondary">Providers Health</a>
<a href="/playground" class="btn secondary">Playground</a>
<p class="meta">
v${VERSION} · by <a href="${AUTHOR_URL}" target="_blank">@${AUTHOR_HANDLE}</a> ·
Powered by public guest endpoints (fxtwitter, syndication, Nitter) · No auth required
</p>
</div>
</body>
</html>`);
});

router.get("/health", (_req, res) => {
  res.json(healthResponse(Object.keys(registry.providers), (Date.now() - START_TIME) / 1000));
});

router.get("/providers", (_req, res) => {
  res.json(
    providerListResponse(
      registry.list(),
      // expose the full configured provider order (even if some don't exist locally)
      process.env.BLITZYXSC_PROVIDER_ORDER
        ? process.env.BLITZYXSC_PROVIDER_ORDER.split(",").map((s) => s.trim()).filter(Boolean)
        : ["composable", "syndication", "nitter", "rss"],
    ),
  );
});

router.get("/providers/health", async (_req, res) => {
  try {
    const results = await registry.healthAll();
    res.json(results);
  } catch (e) {
    res.status(500).json({ error: e?.message || "health check failed" });
  }
});

router.get("/playground", (_req, res) => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.join(here, "playground.html"),
    path.join(process.cwd(), "src", "lib", "playground.html"),
    path.join(process.cwd(), "playground.html"),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        return res.type("html").send(fs.readFileSync(p, "utf8"));
      }
    } catch {
      // try next candidate
    }
  }
  res.status(404).type("html").send("<h1>Playground file not found</h1>");
});

export default router;

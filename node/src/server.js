/**
 * blitzyxsc-express — main Express application entry point.
 *
 * Run locally:  npm start  (or `npm run dev` for --watch auto-reload)
 * Deploy:       works on Railway, Render, Fly.io, or any long-running Node host.
 *               NOT Vercel — Vercel is serverless and Express needs a long-running
 *               HTTP server. Use the Next.js port (../ts/) for Vercel.
 *
 * The Express app mounts CORS + branding middleware, then attaches every
 * router under its prefix. Branding headers (X-Powered-By, X-Author) are
 * added to every response by `brandingMiddleware`.
 */

import express from "express";
import cors from "cors";

import { AUTHOR, AUTHOR_HANDLE, AUTHOR_URL, BRAND, VERSION, brandingMiddleware, settings } from "./lib/config.js";
import metaRouter from "./routes/meta.js";
import postsRouter from "./routes/posts.js";
import searchRouter from "./routes/search.js";
import profileRouter from "./routes/profile.js";
import repliesRouter from "./routes/replies.js";
import mentionsRouter from "./routes/mentions.js";
import trendsRouter from "./routes/trends.js";
import mediaRouter from "./routes/media.js";
import quotesRouter from "./routes/quotes.js";

const app = express();

// ---- middleware -----------------------------------------------------------

app.use(cors({ origin: settings.corsOrigins, methods: ["GET", "OPTIONS"] }));
app.use(express.json());
brandingMiddleware && app.use(brandingMiddleware);

// Branding middleware runs before every route so the X-Powered-By / X-Author
// headers appear on every response, including errors.

// ---- routers --------------------------------------------------------------

app.use("/", metaRouter);
app.use("/posts", postsRouter);
app.use("/search", searchRouter);
app.use("/profile", profileRouter);
app.use("/replies", repliesRouter);
app.use("/mentions", mentionsRouter);
app.use("/trends", trendsRouter);
app.use("/media", mediaRouter);
app.use("/quotes", quotesRouter);

// ---- 404 + error handlers --------------------------------------------------

app.use((req, res) => {
  res.status(404).json({
    error: "not found",
    detail: `${req.method} ${req.path} is not a valid blitzyxsc endpoint`,
    provider: null,
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  const status = err?.status || 500;
  if (status >= 500) {
    // eslint-disable-next-line no-console
    console.error(`[blitzyxsc] ${req.method} ${req.path} →`, err);
  }
  res.status(status).json({
    error: err?.name === "ProviderError" ? "provider error" : err?.message || "internal server error",
    detail: err?.message || null,
    provider: null,
  });
});

// ---- bind -----------------------------------------------------------------

const PORT = settings.port;
const HOST = settings.host;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(
      `⚡ ${BRAND} v${VERSION} by ${AUTHOR_HANDLE} <${AUTHOR}> — listening on http://${HOST}:${PORT}`,
    );
    // eslint-disable-next-line no-console
    console.log(`   Author:  ${AUTHOR_URL}`);
    // eslint-disable-next-line no-console
    console.log(`   Try:     http://localhost:${PORT}/health`);
  });
}

export default app;

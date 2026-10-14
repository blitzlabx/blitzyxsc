/**
 * Shared HTTP helpers for blitzyxsc-express route handlers.
 *
 * Every route uses these helpers so the response shape stays consistent
 * across the entire API surface — JSON body, 502 on ProviderError,
 * 404 on missing data, branding headers attached by the global middleware.
 */

import { errorResponse } from "./schemas.js";

/**
 * Parse an int query param with min/max bounds.
 *
 * @param {import('express').Request} req
 * @param {string} name
 * @param {number} fallback
 * @param {{ min?: number, max?: number }} [bounds]
 * @returns {number}
 */
export function intQuery(req, name, fallback, bounds = {}) {
  const raw = req.query[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return fallback;
  if (bounds.min !== undefined && n < bounds.min) return bounds.min;
  if (bounds.max !== undefined && n > bounds.max) return bounds.max;
  return n;
}

/**
 * Parse a string query param.
 *
 * @param {import('express').Request} req
 * @param {string} name
 * @param {string} [fallback]
 * @returns {string | undefined}
 */
export function strQuery(req, name, fallback) {
  const raw = req.query[name];
  if (raw === undefined || raw === null || raw === "") return fallback;
  return String(raw);
}

/**
 * Parse a boolean query param (1 / true / yes → true).
 *
 * @param {import('express').Request} req
 * @param {string} name
 * @returns {boolean}
 */
export function boolQuery(req, name) {
  const raw = req.query[name];
  if (raw === undefined || raw === null || raw === "") return false;
  return ["1", "true", "yes", "on"].includes(String(raw).toLowerCase());
}

/**
 * Send a JSON response (preserves Express' default 200 status).
 *
 * @param {import('express').Response} res
 * @param {unknown} body
 * @param {number} [status]
 */
export function json(res, body, status = 200) {
  return res.status(status).json(body);
}

/**
 * Send a 502 error response for a provider failure. Mirrors the FastAPI
 * `HTTPException(status_code=502)` pattern in `blitzyxsc_api/routers/`.
 *
 * @param {import('express').Response} res
 * @param {string} message
 * @param {unknown} [providerInfo]
 */
export function badGateway(res, message, providerInfo) {
  return res.status(502).json(errorResponse(message, providerInfo ?? null));
}

/**
 * Send a 404 error response.
 *
 * @param {import('express').Response} res
 * @param {string} message
 */
export function notFound(res, message) {
  return res.status(404).json(errorResponse(message, null));
}

/**
 * Send a 400 error response.
 *
 * @param {import('express').Response} res
 * @param {string} message
 */
export function badRequest(res, message) {
  return res.status(400).json(errorResponse(message, null));
}

/**
 * Wrap an async route handler so ProviderError → 502, generic errors → 500.
 *
 * @param {(req: import('express').Request, res: import('express').Response) => Promise<void>} fn
 * @returns {(req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => Promise<void>}
 */
export function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (e) {
      // ProviderError → 502, anything else → 500
      if (e?.name === "ProviderError") {
        return badGateway(res, e.message || "provider error");
      }
      next(e);
    }
  };
}

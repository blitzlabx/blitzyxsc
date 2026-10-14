/**
 * Shared HTTP helpers used by every blitzyxsc API route handler.
 * Centralises CORS preflight, branding headers, and JSON error envelopes
 * so each route file stays tiny and consistent.
 */
import { NextResponse, type NextRequest } from "next/server";
import { brandHeaders, settings, VERSION, AUTHOR } from "./config";
import type { ErrorResponse } from "./schemas";

/** Build a JSON response with blitzyxsc branding + CORS headers attached. */
export function json<T>(body: T, status: number = 200, extra?: HeadersInit) {
  return NextResponse.json(body, {
    status,
    headers: { ...brandHeaders(), ...(extra ?? {}) },
  });
}

/** Build a JSON error envelope matching the Python `ErrorResponse` model. */
export function errorResponse(
  status: number,
  message: string,
  detail?: unknown,
) {
  const body: ErrorResponse = { error: message, detail };
  return NextResponse.json(body, {
    status,
    headers: brandHeaders(),
  });
}

/** Handle the CORS preflight OPTIONS request every route receives. */
export function preflight() {
  return new NextResponse(null, {
    status: 204,
    headers: brandHeaders(),
  });
}

export function isPreflight(req: NextRequest): boolean {
  return req.method === "OPTIONS";
}

/** Resolve an integer query param with bounds clamping (mirrors Python's `Query(ge=..., le=...)`). */
export function intQuery(
  req: NextRequest,
  key: string,
  fallback: number,
  min = 1,
  max: number = settings.maxPageSize,
): number {
  const raw = req.nextUrl.searchParams.get(key);
  if (raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

export function strQuery(
  req: NextRequest,
  key: string,
  fallback: string | null = null,
): string | null {
  const v = req.nextUrl.searchParams.get(key);
  return v === null ? fallback : v;
}

export const META = {
  brand: settings.brand,
  version: VERSION,
  author: AUTHOR,
} as const;

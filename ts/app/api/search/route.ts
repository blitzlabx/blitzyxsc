import type { NextRequest } from "next/server";
import { ProviderError, registry } from "@/lib/providers";
import { errorResponse, intQuery, isPreflight, json, preflight, strQuery } from "@/lib/http";
import type { TweetListResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/search?q=<query>&limit=...&sort=... — keyword search across providers. */
export async function GET(req: NextRequest) {
  if (isPreflight(req)) return preflight();
  const q = req.nextUrl.searchParams.get("q");
  if (!q) {
    return errorResponse(400, "missing required query param: q");
  }
  const limit = intQuery(req, "limit", 20);
  const cursor = strQuery(req, "cursor");
  const sort = strQuery(req, "sort", "latest") ?? "latest";
  try {
    const { result, info } = await registry.callWithFallback<TweetListResponse["data"]>(
      "searchTweets",
      q,
      limit,
      cursor,
      sort,
    );
    return json<TweetListResponse>({
      data: result,
      provider: info,
      count: result.length,
    });
  } catch (e) {
    if (e instanceof ProviderError) {
      return errorResponse(502, "provider failed", e.message);
    }
    return errorResponse(500, "internal error", (e as Error).message);
  }
}

export function OPTIONS(req: NextRequest) {
  void req;
  return preflight();
}

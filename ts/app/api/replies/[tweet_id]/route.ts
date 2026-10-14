import type { NextRequest } from "next/server";
import { ProviderError, registry } from "@/lib/providers";
import { errorResponse, intQuery, isPreflight, json, preflight, strQuery } from "@/lib/http";
import type { TweetListResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/replies/[tweet_id] — fetch replies to a tweet. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tweet_id: string }> },
) {
  if (isPreflight(req)) return preflight();
  const { tweet_id } = await params;
  const limit = intQuery(req, "limit", 20);
  const cursor = strQuery(req, "cursor");
  try {
    const { result, info } = await registry.callWithFallback<TweetListResponse["data"]>(
      "getReplies",
      tweet_id,
      limit,
      cursor,
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

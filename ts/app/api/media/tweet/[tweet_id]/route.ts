import type { NextRequest } from "next/server";
import { ProviderError, registry } from "@/lib/providers";
import { errorResponse, isPreflight, json, preflight } from "@/lib/http";
import type { MediaItem, TweetResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/media/tweet/[tweet_id] — all media attached to a tweet. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tweet_id: string }> },
) {
  if (isPreflight(req)) return preflight();
  const { tweet_id } = await params;
  try {
    const { result, info } =
      await registry.callWithFallback<TweetResponse["data"]>(
        "getTweet",
        tweet_id,
      );
    const media: MediaItem[] = result.media ?? [];
    return json({
      data: media,
      provider: info,
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

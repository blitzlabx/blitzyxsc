import type { NextRequest } from "next/server";
import { ProviderError, registry } from "@/lib/providers";
import { errorResponse, isPreflight, json, preflight } from "@/lib/http";
import type { Trend, TrendResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/trends — current trending topics across providers. */
export async function GET(req: NextRequest) {
  if (isPreflight(req)) return preflight();
  const woeidParam = req.nextUrl.searchParams.get("woeid");
  const location = req.nextUrl.searchParams.get("location");
  const woeid = woeidParam ? Number(woeidParam) || null : null;
  try {
    const { result, info } =
      await registry.callWithFallback<Trend[]>("getTrends", woeid, location);
    const body: TrendResponse = {
      trends: result,
      as_of: new Date().toISOString(),
      created_at: null,
      locations: [],
      provider: info,
    };
    return json<TrendResponse>(body);
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

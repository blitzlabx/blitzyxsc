import type { NextRequest } from "next/server";
import { ProviderError, registry } from "@/lib/providers";
import { errorResponse, isPreflight, json, preflight } from "@/lib/http";
import type { ProfileResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/profile/[username] — fetch a user's profile. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  if (isPreflight(req)) return preflight();
  const { username } = await params;
  try {
    const { result, info } = await registry.callWithFallback<ProfileResponse["data"]>(
      "getProfile",
      username,
    );
    return json<ProfileResponse>({ data: result, provider: info });
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

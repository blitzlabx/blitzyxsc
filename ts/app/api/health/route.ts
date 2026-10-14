import type { NextRequest } from "next/server";
import { registry } from "@/lib/providers";
import { isPreflight, json, preflight } from "@/lib/http";
import { VERSION, AUTHOR, BRAND } from "@/lib/config";
import type { HealthResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

const START_TIME = Date.now();

/** GET /api/health — health check + provider status. */
export async function GET(req: NextRequest) {
  if (isPreflight(req)) return preflight();
  const body: HealthResponse = {
    status: "ok",
    brand: BRAND,
    version: VERSION,
    author: AUTHOR,
    providers: Object.keys(registry.providers),
    uptime_seconds: (Date.now() - START_TIME) / 1000,
  };
  return json<HealthResponse>(body);
}

export function OPTIONS(req: NextRequest) {
  void req;
  return preflight();
}

import type { NextRequest } from "next/server";
import { registry } from "@/lib/providers";
import { isPreflight, json, preflight } from "@/lib/http";
import { settings } from "@/lib/config";
import type { ProviderListResponse } from "@/lib/schemas";

export const dynamic = "force-dynamic";

/** GET /api/providers — list configured providers and their priority order. */
export async function GET(req: NextRequest) {
  if (isPreflight(req)) return preflight();
  const body: ProviderListResponse = {
    providers: registry.list(),
    order: settings.providerOrder,
  };
  return json(body);
}

export function OPTIONS(req: NextRequest) {
  void req;
  return preflight();
}

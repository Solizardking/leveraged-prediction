import { NextRequest, NextResponse } from "next/server";
import {
  buildEncryptedUtxosRequest,
  heliusEncryptedUtxosUrl,
  parseEncryptedUtxoPage,
  readHeliusApiKey,
} from "@/app/lib/helius/privacy";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      tags?: unknown;
      limit?: unknown;
      paginationToken?: unknown;
      filters?: { slot?: { gt?: number; gte?: number; lt?: number; lte?: number } };
    };
    if (!Array.isArray(body.tags) || !body.tags.every((tag) => typeof tag === "string")) {
      return noStore({ error: "tags must be an array of view tags" }, { status: 400 });
    }
    const rpcBody = buildEncryptedUtxosRequest({
      tags: body.tags,
      limit: typeof body.limit === "number" ? body.limit : undefined,
      paginationToken: typeof body.paginationToken === "string" ? body.paginationToken : undefined,
      filters: body.filters,
    });
    const key = readHeliusApiKey();
    const response = await fetch(heliusEncryptedUtxosUrl(key), {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
      cache: "no-store",
    });
    const payload = await response.json() as unknown;
    if (!response.ok) {
      return noStore({ error: `Helius privacy proxy failed (${response.status})` }, { status: 503 });
    }
    return noStore(parseEncryptedUtxoPage(payload));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Helius privacy proxy failed";
    return noStore({ error: message.replace(/api-key=[^&\s"]+/gi, "api-key=[redacted]") }, { status: 503 });
  }
}

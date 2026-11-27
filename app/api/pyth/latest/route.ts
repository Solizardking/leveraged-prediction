import { NextRequest, NextResponse } from "next/server";
import { fetchPythLatest } from "@/app/lib/pyth/server";
import { parsePythSymbolsParam } from "@/app/lib/pyth/symbols";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const symbols = parsePythSymbolsParam(request.nextUrl.searchParams.get("symbols"));
    return noStore({ prices: await fetchPythLatest(symbols) });
  } catch (error) {
    return noStore({
      error: error instanceof Error ? error.message : "Pyth latest price failed",
    }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { symbols?: unknown };
    const raw = Array.isArray(body.symbols) ? body.symbols.join(",") : null;
    const symbols = parsePythSymbolsParam(raw);
    return noStore({ prices: await fetchPythLatest(symbols) });
  } catch (error) {
    return noStore({
      error: error instanceof Error ? error.message : "Pyth latest price failed",
    }, { status: 503 });
  }
}

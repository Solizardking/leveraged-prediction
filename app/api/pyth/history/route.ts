import { NextRequest, NextResponse } from "next/server";
import { fetchPythHistory } from "@/app/lib/pyth/server";
import { isSupportedPythSymbol, DEFAULT_PYTH_SYMBOL } from "@/app/lib/pyth/symbols";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function noStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("cache-control", "no-store");
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const symbol = request.nextUrl.searchParams.get("symbol") ?? DEFAULT_PYTH_SYMBOL;
    if (!isSupportedPythSymbol(symbol)) {
      return noStore({ error: `Unsupported Pyth symbol: ${symbol}` }, { status: 400 });
    }
    const now = Math.floor(Date.now() / 1000);
    const from = Number(request.nextUrl.searchParams.get("from") ?? now - 7 * 24 * 60 * 60);
    const to = Number(request.nextUrl.searchParams.get("to") ?? now);
    const resolution = request.nextUrl.searchParams.get("resolution") ?? "1D";
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
      return noStore({ error: "from and to must be unix seconds with from < to" }, { status: 400 });
    }
    return noStore({ symbol, bars: await fetchPythHistory(symbol, from, to, resolution) });
  } catch (error) {
    return noStore({
      error: error instanceof Error ? error.message : "Pyth history failed",
    }, { status: 503 });
  }
}

import { NextResponse } from "next/server";
import { fetchImperialMarkets, listPythImperialListings } from "@/app/lib/imperial/markets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const markets = await fetchImperialMarkets();
    return NextResponse.json({
      listings: listPythImperialListings(markets),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Imperial markets failed",
    }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}

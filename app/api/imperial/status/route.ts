import { NextResponse } from "next/server";
import { isImperialTradingEnabled } from "@/app/lib/imperial/markets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    tradingEnabled: isImperialTradingEnabled(),
  }, { headers: { "cache-control": "no-store" } });
}

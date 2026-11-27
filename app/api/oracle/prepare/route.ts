import { NextRequest, NextResponse } from "next/server";
import { fetchOracleQuotes } from "@/app/lib/oracle-market/pyth-client";
import {
  prepareOracleOrder,
  type OracleOrderKind,
  type OracleSide,
} from "@/app/lib/oracle-market/prepare-order";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Prepares an unsigned oracle-market order intent for the user's own
 * wallet to sign in the browser. Preparation only — this route never
 * signs and never broadcasts, and it refuses to prepare against a
 * stale or unavailable oracle price.
 */
export async function POST(request: NextRequest) {
  if (process.env.ORACLE_MARKET_ENABLED !== "1") {
    return NextResponse.json(
      { code: "ORACLE_MARKET_DISABLED", error: "Oracle markets are not enabled" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const body = (await request.json()) as {
      marketId?: string;
      orderKind?: OracleOrderKind;
      side?: OracleSide;
      size?: number;
      leverage?: number;
      funding?: "public" | "confidential";
      owner?: string;
      collateralMint?: string;
      collateralAmount?: number;
    };
    if (
      !body.marketId ||
      !body.orderKind ||
      !body.side ||
      typeof body.size !== "number" ||
      !body.owner ||
      !body.collateralMint ||
      typeof body.collateralAmount !== "number"
    ) {
      return NextResponse.json(
        { code: "INVALID_ORDER", error: "Missing or invalid order fields" },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const batch = await fetchOracleQuotes();
    const quote = batch.quotes.find((entry) => entry.marketId === body.marketId);
    if (!quote) {
      return NextResponse.json(
        { code: "UNKNOWN_MARKET", error: `Unknown oracle market: ${body.marketId}` },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }
    const intent = await prepareOracleOrder({
      marketId: body.marketId,
      orderKind: body.orderKind,
      side: body.side,
      size: body.size,
      leverage: body.leverage,
      funding: body.funding ?? "public",
      owner: body.owner,
      collateralMint: body.collateralMint,
      collateralAmount: body.collateralAmount,
      quote,
    });
    return NextResponse.json(intent, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      {
        code: "PREPARE_FAILED",
        error: error instanceof Error ? error.message : "Order preparation failed",
      },
      { status: 422, headers: { "cache-control": "no-store" } },
    );
  }
}

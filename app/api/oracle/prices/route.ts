import { NextResponse } from "next/server";
import { ORACLE_MARKETS } from "@/app/lib/oracle-market/markets";
import { fetchOracleQuotes } from "@/app/lib/oracle-market/pyth-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Oracle prices for the Privacy Rings-wrapped Pyth markets.
 *
 * The whole feature is behind ORACLE_MARKET_ENABLED (default OFF): with
 * the flag unset this route answers 503 and the /oracle page renders its
 * inert state, so the deploy carries no live surface until the owner
 * enables it. The Pyth key stays server-side; only prices leave.
 */
export async function GET() {
  if (process.env.ORACLE_MARKET_ENABLED !== "1") {
    return NextResponse.json(
      { code: "ORACLE_MARKET_DISABLED", error: "Oracle markets are not enabled" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const batch = await fetchOracleQuotes();
    const quotesById = new Map(batch.quotes.map((quote) => [quote.marketId, quote]));
    return NextResponse.json(
      {
        generatedAt: batch.generatedAt,
        markets: ORACLE_MARKETS.map((market) => ({
          id: market.id,
          symbol: market.symbol,
          oracleSymbol: market.oracleSymbol,
          assetClass: market.assetClass,
          priceDecimals: market.priceDecimals,
          spot: market.spot,
          perps: market.perps,
          quote: quotesById.get(market.id) ?? null,
        })),
      },
      { headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        code: "ORACLE_FEED_UNAVAILABLE",
        error: error instanceof Error ? error.message : "Oracle feed failed",
      },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

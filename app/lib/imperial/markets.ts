import { PYTH_MARKET_SYMBOLS, type PythMarketSymbol } from "@/app/lib/pyth/symbols";

export const IMPERIAL_MARKETS_URL = "https://api.imperial.trade/api/v1/armada/markets";

export interface ImperialMarketSummary {
  symbol: string;
  marketId: number | null;
  maxLeverage: number | null;
}

export type ImperialListing = "tradeable" | "price-only";

export interface PythImperialListing {
  pyth: PythMarketSymbol;
  listing: ImperialListing;
  imperial: ImperialMarketSummary | null;
}

export function isImperialTradingEnabled(
  value = process.env.IMPERIAL_TRADING_ENABLED,
): boolean {
  return value === "1" || value === "true";
}

export function parseImperialMarkets(payload: unknown): ImperialMarketSummary[] {
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
      ? (payload as { data: unknown[] }).data
      : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const item = row as { symbol?: unknown; marketId?: unknown; maxLeverage?: unknown };
    if (typeof item.symbol !== "string" || item.symbol.length === 0) return [];
    return [{
      symbol: item.symbol.toUpperCase(),
      marketId: typeof item.marketId === "number" ? item.marketId : null,
      maxLeverage: typeof item.maxLeverage === "number" ? item.maxLeverage : null,
    }];
  });
}

export function listPythImperialListings(
  markets: ImperialMarketSummary[],
): PythImperialListing[] {
  const bySymbol = new Map(markets.map((market) => [market.symbol, market]));
  return PYTH_MARKET_SYMBOLS.map((pyth) => {
    const imperial = pyth.imperialSymbol ? bySymbol.get(pyth.imperialSymbol) ?? null : null;
    return {
      pyth,
      listing: imperial ? "tradeable" : "price-only",
      imperial,
    };
  });
}

export async function fetchImperialMarkets(
  fetchImpl: typeof fetch = fetch,
): Promise<ImperialMarketSummary[]> {
  const response = await fetchImpl(IMPERIAL_MARKETS_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Imperial markets failed (${response.status})`);
  }
  return parseImperialMarkets(await response.json());
}

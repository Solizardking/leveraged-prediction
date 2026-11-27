/**
 * Client-side view of /api/oracle/prices. Types only mirror the route
 * payload; the Pyth key and the feed itself stay server-side.
 */

export interface OracleQuoteView {
  marketId: string;
  price: number | null;
  previousClose: number | null;
  barTime: number | null;
  resolutionSeconds: number | null;
  ageSeconds: number | null;
  status: "live" | "stale" | "unavailable";
  bars: { t: number; o: number; h: number; l: number; c: number }[];
}

export interface OracleMarketView {
  id: string;
  symbol: string;
  oracleSymbol: string;
  assetClass: "crypto" | "metals" | "fx" | "equities";
  priceDecimals: number;
  spot: { enabled: true };
  perps: { enabled: true; maxLeverage: number };
  quote: OracleQuoteView | null;
}

export interface OraclePricesPayload {
  generatedAt: number;
  markets: OracleMarketView[];
}

export class OracleFeedDisabledError extends Error {
  constructor() {
    super("Oracle markets are not enabled");
    this.name = "OracleFeedDisabledError";
  }
}

export async function fetchOraclePrices(
  signal?: AbortSignal,
): Promise<OraclePricesPayload> {
  const response = await fetch("/api/oracle/prices", {
    cache: "no-store",
    signal,
  });
  if (response.status === 503) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
    } | null;
    if (body?.code === "ORACLE_MARKET_DISABLED") {
      throw new OracleFeedDisabledError();
    }
    throw new Error("Oracle feed unavailable");
  }
  if (!response.ok) {
    throw new Error(`Oracle prices failed: HTTP ${response.status}`);
  }
  return (await response.json()) as OraclePricesPayload;
}

export function formatOraclePrice(
  value: number | null,
  decimals: number,
): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function oracleChangePercent(
  quote: OracleQuoteView | null,
): number | null {
  if (!quote || quote.price === null || !quote.previousClose) return null;
  return ((quote.price - quote.previousClose) / quote.previousClose) * 100;
}

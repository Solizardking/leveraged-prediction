import { pythMarketBySymbol, type PythMarketSymbol } from "@/app/lib/pyth/symbols";

export const PYTH_LATEST_URL = "https://pyth-lazer-0.dourolabs.app/v1/latest_price";
export const PYTH_HISTORY_URL = "https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history";
export const PYTH_CHANNEL = "fixed_rate@1000ms";

export function readPythApiKey(): string {
  const key = process.env.PYTH_API_KEY?.trim();
  if (!key) {
    throw new Error("PYTH_API_KEY is not configured on the server");
  }
  return key;
}

export interface PythLatestPrice {
  symbol: string;
  priceFeedId: number;
  price: number;
  rawPrice: string;
  exponent: number;
  confidence: string | null;
  publisherCount: number | null;
  feedUpdateTimestamp: number | null;
  timestampUs: string | null;
}

export interface PythHistoryBar {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

function headers(key: string, json = false): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

function sanitizeError(error: unknown): Error {
  const message = error instanceof Error ? error.message : "Pyth request failed";
  return new Error(message.replace(/Bearer\s+\S+/gi, "Bearer [redacted]"));
}

interface LatestFeed {
  priceFeedId?: number;
  price?: string;
  exponent?: number;
  confidence?: string | number;
  publisherCount?: number;
  feedUpdateTimestamp?: number;
}

function displayPrice(raw: string, exponent: number): number {
  return Number(raw) * 10 ** exponent;
}

export function parseLatestPayload(payload: unknown, requested: string[]): PythLatestPrice[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Pyth latest price response was empty");
  }
  const parsed = (payload as { parsed?: { timestampUs?: string; priceFeeds?: LatestFeed[] } }).parsed;
  const feeds = parsed?.priceFeeds ?? [];
  const byId = new Map<number, LatestFeed>();
  for (const feed of feeds) {
    if (typeof feed.priceFeedId === "number") byId.set(feed.priceFeedId, feed);
  }
  return requested.map((symbol) => {
    const meta = pythMarketBySymbol(symbol) as PythMarketSymbol;
    const feed = byId.get(meta.pythLazerId);
    if (!feed || feed.price === undefined || feed.exponent === undefined) {
      throw new Error(`Pyth latest price missing for ${symbol}`);
    }
    return {
      symbol,
      priceFeedId: meta.pythLazerId,
      price: displayPrice(String(feed.price), feed.exponent),
      rawPrice: String(feed.price),
      exponent: feed.exponent,
      confidence: feed.confidence === undefined ? null : String(feed.confidence),
      publisherCount: feed.publisherCount ?? null,
      feedUpdateTimestamp: feed.feedUpdateTimestamp ?? null,
      timestampUs: parsed?.timestampUs ?? null,
    };
  });
}

export async function fetchPythLatest(symbols: string[], key = readPythApiKey()): Promise<PythLatestPrice[]> {
  try {
    const response = await fetch(PYTH_LATEST_URL, {
      method: "POST",
      headers: headers(key, true),
      body: JSON.stringify({
        channel: PYTH_CHANNEL,
        formats: [],
        properties: ["price", "exponent", "confidence", "feedUpdateTimestamp", "publisherCount"],
        symbols,
      }),
      cache: "no-store",
    });
    const body = await response.json() as unknown;
    if (!response.ok) {
      throw new Error(`Pyth latest price failed (${response.status})`);
    }
    return parseLatestPayload(body, symbols);
  } catch (error) {
    throw sanitizeError(error);
  }
}

export function parseHistoryPayload(payload: unknown): PythHistoryBar[] {
  if (!payload || typeof payload !== "object") {
    throw new Error("Pyth history response was empty");
  }
  const body = payload as { s?: string; t?: number[]; o?: number[]; h?: number[]; l?: number[]; c?: number[] };
  if (body.s && body.s !== "ok") {
    throw new Error("Pyth history request was not ok");
  }
  const times = body.t ?? [];
  return times.map((time, index) => ({
    time,
    open: Number(body.o?.[index] ?? 0),
    high: Number(body.h?.[index] ?? 0),
    low: Number(body.l?.[index] ?? 0),
    close: Number(body.c?.[index] ?? body.o?.[index] ?? 0),
  }));
}

export async function fetchPythHistory(
  symbol: string,
  from: number,
  to: number,
  resolution = "1D",
  key = readPythApiKey(),
): Promise<PythHistoryBar[]> {
  const url = new URL(PYTH_HISTORY_URL);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", String(from));
  url.searchParams.set("to", String(to));
  url.searchParams.set("resolution", resolution);
  try {
    const response = await fetch(url, {
      headers: headers(key),
      cache: "no-store",
    });
    const body = await response.json() as unknown;
    if (!response.ok) {
      throw new Error(`Pyth history failed (${response.status})`);
    }
    return parseHistoryPayload(body);
  } catch (error) {
    throw sanitizeError(error);
  }
}

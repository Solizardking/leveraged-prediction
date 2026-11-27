/**
 * Pyth fixed-rate feed client — SERVER ONLY.
 *
 * Reads the Dourolabs fixed-rate history API:
 *   GET https://pyth.dourolabs.app/v1/fixed_rate@1000ms/history
 *       ?symbol=<oracle symbol>&from=<unix>&to=<unix>&resolution=<res>
 *   Authorization: Bearer <PYTH_API_KEY>
 *
 * The key comes from the PYTH_API_KEY env var and must never reach the
 * browser — this module is imported only by the /api/oracle route
 * handler. Responses are TradingView-style OHLC arrays
 * ({ s, t[], o[], h[], l[], c[], v[] }).
 *
 * Operational facts, all verified live against the API:
 * - The API sits behind Cloudflare, which rejects default HTTP-client
 *   user agents with 403 (error code 1010). An explicit User-Agent
 *   header is required.
 * - fixed_rate@1000ms is the only channel (500ms / 2000ms are rejected
 *   as unknown channels), and /history is the only data endpoint:
 *   /latest answers 404 and there is no symbol-list endpoint. The
 *   newest bar of the history response is the last price, and the
 *   in-progress bar's close updates as the bar builds.
 * - Resolutions are TradingView-style: "1", "5", "15", "60", "240"
 *   minutes and "1D" all return data; resolution is a required param.
 *
 * Fail-closed: a failed fetch, an empty series, or a newest bar older
 * than the market's staleness window yields status "stale" or
 * "unavailable" — never a silently-trusted old price.
 */

import { ORACLE_MARKETS, type OracleMarket } from "./markets";

const API_BASE = "https://pyth.dourolabs.app";
const HISTORY_PATH = "/v1/fixed_rate@1000ms/history";
const USER_AGENT = "leveraged-prediction-oracle/1.0";
const FETCH_TIMEOUT_MS = Number(process.env.ORACLE_FEED_TIMEOUT_MS ?? 15_000);
const CACHE_TTL_MS = 20_000;
/** Upstream reads run in small batches so 21 markets never burst at once. */
const FETCH_CONCURRENCY = 6;

export interface OracleBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}

export type OracleQuoteStatus = "live" | "stale" | "unavailable";

export interface OracleQuote {
  marketId: string;
  /** Latest close, or null when no trustworthy price exists. */
  price: number | null;
  /** Previous close, for the change line. Null when unavailable. */
  previousClose: number | null;
  /** Unix seconds of the newest bar's open. */
  barTime: number | null;
  /** Resolution (seconds) of the bar the price came from. */
  resolutionSeconds: number | null;
  /** Seconds since that bar closed (0 while it is still building). */
  ageSeconds: number | null;
  status: OracleQuoteStatus;
  /** Recent bars, oldest first, for sparklines. Empty when unavailable. */
  bars: OracleBar[];
}

interface HistoryResponse {
  s: string;
  t?: number[];
  o?: number[];
  h?: number[];
  l?: number[];
  c?: number[];
}

function apiKey(): string {
  const key = process.env.PYTH_API_KEY;
  if (!key) {
    throw new Error("PYTH_API_KEY is not configured");
  }
  return key;
}

async function fetchHistory(
  oracleSymbol: string,
  from: number,
  to: number,
  resolution: string,
): Promise<OracleBar[]> {
  const params = new URLSearchParams({
    symbol: oracleSymbol,
    from: String(from),
    to: String(to),
    resolution,
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE}${HISTORY_PATH}?${params}`, {
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "User-Agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Pyth history ${oracleSymbol} -> HTTP ${response.status}`);
    }
    const body = (await response.json()) as HistoryResponse;
    if (body.s !== "ok" || !body.t || !body.c) {
      return [];
    }
    const bars: OracleBar[] = [];
    for (let i = 0; i < body.t.length; i += 1) {
      bars.push({
        t: body.t[i],
        o: body.o?.[i] ?? body.c[i],
        h: body.h?.[i] ?? body.c[i],
        l: body.l?.[i] ?? body.c[i],
        c: body.c[i],
      });
    }
    return bars;
  } finally {
    clearTimeout(timer);
  }
}

function quoteFromBars(
  market: OracleMarket,
  bars: OracleBar[],
  resolutionSeconds: number,
  now: number,
): OracleQuote {
  const last = bars[bars.length - 1];
  if (!last) {
    return {
      marketId: market.id,
      price: null,
      previousClose: null,
      barTime: null,
      resolutionSeconds: null,
      ageSeconds: null,
      status: "unavailable",
      bars: [],
    };
  }
  const ageSeconds = Math.max(0, now - (last.t + resolutionSeconds));
  return {
    marketId: market.id,
    price: last.c,
    previousClose: bars.length > 1 ? bars[bars.length - 2].c : null,
    barTime: last.t,
    resolutionSeconds,
    ageSeconds,
    status: ageSeconds <= market.maxStaleSeconds ? "live" : "stale",
    bars: bars.slice(-120),
  };
}

async function fetchMarketQuote(
  market: OracleMarket,
  now: number,
): Promise<OracleQuote> {
  // Intraday first: 1-minute bars over the last two hours. (Resolutions
  // on this API are TradingView-style minutes: "1", "5", "15", "60",
  // "1D" — all verified live.)
  try {
    const intraday = await fetchHistory(
      market.oracleSymbol,
      now - 2 * 60 * 60,
      now,
      "1",
    );
    if (intraday.length > 0) {
      return quoteFromBars(market, intraday, 60, now);
    }
  } catch {
    // Fall through to the daily series; a failed intraday read must not
    // be mistaken for a live price, and the daily bar still carries an
    // honest timestamp for the staleness check.
  }
  // Daily fallback: covers session markets outside trading hours and any
  // symbol the intraday resolution does not serve.
  try {
    const daily = await fetchHistory(
      market.oracleSymbol,
      now - 10 * 86_400,
      now,
      "1D",
    );
    if (daily.length > 0) {
      return quoteFromBars(market, daily, 86_400, now);
    }
  } catch {
    // Handled below as unavailable.
  }
  return {
    marketId: market.id,
    price: null,
    previousClose: null,
    barTime: null,
    resolutionSeconds: null,
    ageSeconds: null,
    status: "unavailable",
    bars: [],
  };
}

export interface OracleQuoteBatch {
  generatedAt: number;
  quotes: OracleQuote[];
}

let cache: { at: number; batch: OracleQuoteBatch } | null = null;

export async function fetchOracleQuotes(): Promise<OracleQuoteBatch> {
  const now = Math.floor(Date.now() / 1000);
  if (cache && now * 1000 - cache.at < CACHE_TTL_MS) {
    return cache.batch;
  }
  const quotes: OracleQuote[] = [];
  for (let i = 0; i < ORACLE_MARKETS.length; i += FETCH_CONCURRENCY) {
    const chunk = ORACLE_MARKETS.slice(i, i + FETCH_CONCURRENCY);
    quotes.push(
      ...(await Promise.all(chunk.map((market) => fetchMarketQuote(market, now)))),
    );
  }
  const batch: OracleQuoteBatch = { generatedAt: now, quotes };
  cache = { at: now * 1000, batch };
  return batch;
}

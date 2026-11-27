import { describe, expect, it } from "vitest";
import { parseLatestPayload, parseHistoryPayload } from "@/app/lib/pyth/server";
import {
  DEFAULT_PYTH_SYMBOL,
  isLeverGameSymbol,
  isSupportedPythSymbol,
  parsePythSymbolsParam,
  PYTH_MARKET_SYMBOLS,
} from "@/app/lib/pyth/symbols";

describe("Pyth market catalog", () => {
  it("lists 21 supported symbols and keeps Lever on BTC", () => {
    expect(PYTH_MARKET_SYMBOLS).toHaveLength(21);
    expect(isLeverGameSymbol(DEFAULT_PYTH_SYMBOL)).toBe(true);
    expect(isLeverGameSymbol("Crypto.ETH/USD")).toBe(false);
    expect(isSupportedPythSymbol("Crypto.BTC/USD")).toBe(true);
    expect(() => parsePythSymbolsParam("Not.A/Symbol")).toThrow(/Unsupported/);
    expect(parsePythSymbolsParam("Crypto.ETH/USD,Crypto.BTC/USD")).toEqual([
      "Crypto.ETH/USD",
      "Crypto.BTC/USD",
    ]);
  });

  it("parses latest and history payloads", () => {
    const prices = parseLatestPayload({
      parsed: {
        timestampUs: "1",
        priceFeeds: [{ priceFeedId: 1, price: "6061700000000", exponent: -8, publisherCount: 20 }],
      },
    }, ["Crypto.BTC/USD"]);
    expect(prices[0]?.price).toBeCloseTo(60617);
    const bars = parseHistoryPayload({ s: "ok", t: [1, 2], o: [1, 2], h: [2, 3], l: [1, 2], c: [1.5, 2.5] });
    expect(bars).toHaveLength(2);
    expect(bars[1]?.close).toBe(2.5);
  });
});

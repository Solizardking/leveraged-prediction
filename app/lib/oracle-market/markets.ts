/**
 * Oracle market registry — spot + perps market definitions priced by the
 * Pyth fixed-rate feed (see pyth-client.ts). These are market *definitions*
 * and a pricing layer only: order placement is transaction preparation that
 * the user's own wallet signs in the browser. Nothing here signs, holds
 * keys, or broadcasts.
 *
 * The symbol universe is NOT duplicated here: it derives from the repo's
 * canonical Pyth list (app/lib/pyth/symbols.ts, the same 20 markets the
 * game arena uses), so the two surfaces can never drift apart. This module
 * adds only what the oracle-market layer needs on top: display precision,
 * staleness windows, and per-market leverage caps. Every symbol was
 * verified against the live Dourolabs history endpoint (all 20 return
 * data; gold trades as Metal.XAU/USD).
 */

import {
  PYTH_MARKET_SYMBOLS,
  type PythAssetClass,
} from "@/app/lib/pyth/symbols";

export type OracleAssetClass = "crypto" | "metals" | "fx" | "equities";

export interface OracleMarket {
  /** Stable slug used in URLs and API payloads. */
  id: string;
  /** Display pair, e.g. "BTC/USD". */
  symbol: string;
  /** Exact symbol the Pyth fixed-rate API expects. */
  oracleSymbol: string;
  assetClass: OracleAssetClass;
  /** Decimal places used when rendering the price. */
  priceDecimals: number;
  /**
   * A newest-bar age beyond this marks the market stale/halted. Crypto
   * trades around the clock, so its window is minutes. Metals, FX and
   * equities trade in sessions, so their window covers an overnight gap;
   * over a weekend those markets honestly read as stale (no fresh print)
   * rather than silently trading on an old price.
   */
  maxStaleSeconds: number;
  spot: { enabled: true };
  perps: {
    enabled: true;
    /** Definition only — the leverage cap this market would carry. */
    maxLeverage: number;
  };
}

const CRYPTO_STALE = 300; // 5 minutes
const SESSION_STALE = 26 * 60 * 60; // 26 hours

const ASSET_CLASS_MAP: Record<PythAssetClass, OracleAssetClass> = {
  metal: "metals",
  fx: "fx",
  equity: "equities",
  crypto: "crypto",
};

/** Oracle-layer extras per oracle symbol: [priceDecimals, maxLeverage]. */
const MARKET_EXTRAS: Record<string, [number, number]> = {
  "Metal.XAU/USD": [2, 20],
  "Metal.XAG/USD": [3, 20],
  "FX.USD/JPY": [3, 50],
  "FX.USD/CNH": [4, 50],
  "FX.EUR/USD": [5, 50],
  "Equity.US.VOO/USD": [2, 10],
  "Equity.US.TSLA/USD": [2, 10],
  "Equity.US.QQQ/USD": [2, 10],
  "Crypto.XRP/USD": [4, 20],
  "Crypto.WBTC/USD": [2, 20],
  "Crypto.USDT/USD": [4, 10],
  "Crypto.USDC/USD": [4, 10],
  "Crypto.STETH/USD": [2, 20],
  "Crypto.SOL/USD": [2, 20],
  "Crypto.PYTH/USD": [5, 10],
  "Crypto.JITOSOL/USD": [3, 10],
  "Crypto.HYPE/USD": [3, 20],
  "Crypto.ETH/USD": [2, 20],
  "Crypto.DOGE/USD": [5, 20],
  "Crypto.BTC/USD": [2, 20],
  "Crypto.BNB/USD": [2, 20],
};

function displaySymbol(oracleSymbol: string): string {
  // "Equity.US.VOO/USD" -> "VOO/USD"; "Metal.XAU/USD" -> "XAU/USD".
  return oracleSymbol.split(".").pop() ?? oracleSymbol;
}

export const ORACLE_MARKETS: OracleMarket[] = PYTH_MARKET_SYMBOLS.map(
  (entry) => {
    const extras = MARKET_EXTRAS[entry.symbol];
    if (!extras) {
      throw new Error(
        `Oracle market extras missing for ${entry.symbol}; add price decimals and a leverage cap in markets.ts`,
      );
    }
    const [priceDecimals, maxLeverage] = extras;
    const assetClass = ASSET_CLASS_MAP[entry.assetClass];
    const symbol = displaySymbol(entry.symbol);
    return {
      id: symbol.toLowerCase().replace("/", "-"),
      symbol,
      oracleSymbol: entry.symbol,
      assetClass,
      priceDecimals,
      maxStaleSeconds: assetClass === "crypto" ? CRYPTO_STALE : SESSION_STALE,
      spot: { enabled: true },
      perps: { enabled: true, maxLeverage },
    };
  },
);

export const ORACLE_ASSET_CLASSES: { id: OracleAssetClass; label: string }[] = [
  { id: "metals", label: "Metals" },
  { id: "fx", label: "FX" },
  { id: "equities", label: "Equities" },
  { id: "crypto", label: "Crypto" },
];

export function oracleMarketById(id: string): OracleMarket | undefined {
  return ORACLE_MARKETS.find((entry) => entry.id === id);
}

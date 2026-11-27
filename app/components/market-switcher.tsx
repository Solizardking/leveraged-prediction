"use client";

import type { PythImperialListing } from "@/app/lib/imperial/markets";
import { PYTH_MARKET_SYMBOLS } from "@/app/lib/pyth/symbols";

export function MarketSwitcher({
  symbol,
  listings,
  onChange,
}: {
  symbol: string;
  listings: PythImperialListing[];
  onChange: (symbol: string) => void;
}) {
  const bySymbol = new Map(listings.map((item) => [item.pyth.symbol, item]));
  return (
    <div className="market-switcher">
      <label className="sr-only" htmlFor="market-select">Market</label>
      <select
        id="market-select"
        className="market-select"
        value={symbol}
        onChange={(event) => onChange(event.target.value)}
      >
        {PYTH_MARKET_SYMBOLS.map((market) => {
          const listing = bySymbol.get(market.symbol);
          const badge = listing?.listing === "tradeable" ? "Imperial" : "Price only";
          return (
            <option key={market.symbol} value={market.symbol}>
              {market.label} · {badge}
            </option>
          );
        })}
      </select>
      {bySymbol.get(symbol) ? (
        <span className={`listing-badge ${bySymbol.get(symbol)?.listing}`}>
          {bySymbol.get(symbol)?.listing === "tradeable"
            ? `Tradeable on Imperial${bySymbol.get(symbol)?.imperial?.maxLeverage
              ? ` · up to ${Math.round(bySymbol.get(symbol)!.imperial!.maxLeverage!)}x`
              : ""}`
            : "Price only · no Imperial market"}
        </span>
      ) : null}
    </div>
  );
}

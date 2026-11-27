export type PythAssetClass = "metal" | "fx" | "equity" | "crypto";

export interface PythMarketSymbol {
  symbol: string;
  label: string;
  assetClass: PythAssetClass;
  /** Imperial Armada symbol when a matching perp exists. */
  imperialSymbol: string | null;
  pythLazerId: number;
}

/** Display and Imperial mapping for the product's supported Pyth Pro symbols. */
export const PYTH_MARKET_SYMBOLS: readonly PythMarketSymbol[] = [
  { symbol: "Metal.XAU/USD", label: "Gold", assetClass: "metal", imperialSymbol: "XAU", pythLazerId: 346 },
  { symbol: "Metal.XAG/USD", label: "Silver", assetClass: "metal", imperialSymbol: "XAG", pythLazerId: 345 },
  { symbol: "FX.USD/JPY", label: "USD/JPY", assetClass: "fx", imperialSymbol: "USDJPY", pythLazerId: 340 },
  { symbol: "FX.USD/CNH", label: "USD/CNH", assetClass: "fx", imperialSymbol: null, pythLazerId: 1508 },
  { symbol: "FX.EUR/USD", label: "EUR/USD", assetClass: "fx", imperialSymbol: "EURUSD", pythLazerId: 327 },
  { symbol: "Equity.US.VOO/USD", label: "VOO", assetClass: "equity", imperialSymbol: null, pythLazerId: 1472 },
  { symbol: "Equity.US.TSLA/USD", label: "Tesla", assetClass: "equity", imperialSymbol: "TSLA", pythLazerId: 1435 },
  { symbol: "Equity.US.QQQ/USD", label: "QQQ", assetClass: "equity", imperialSymbol: "QQQ", pythLazerId: 1363 },
  { symbol: "Crypto.XRP/USD", label: "XRP", assetClass: "crypto", imperialSymbol: "XRP", pythLazerId: 14 },
  { symbol: "Crypto.WBTC/USD", label: "Wrapped BTC", assetClass: "crypto", imperialSymbol: null, pythLazerId: 103 },
  { symbol: "Crypto.USDT/USD", label: "USDT", assetClass: "crypto", imperialSymbol: null, pythLazerId: 8 },
  { symbol: "Crypto.USDC/USD", label: "USDC", assetClass: "crypto", imperialSymbol: null, pythLazerId: 7 },
  { symbol: "Crypto.STETH/USD", label: "stETH", assetClass: "crypto", imperialSymbol: null, pythLazerId: 572 },
  { symbol: "Crypto.SOL/USD", label: "Solana", assetClass: "crypto", imperialSymbol: "SOL", pythLazerId: 6 },
  { symbol: "Crypto.PYTH/USD", label: "PYTH", assetClass: "crypto", imperialSymbol: "PYTH", pythLazerId: 3 },
  { symbol: "Crypto.JITOSOL/USD", label: "JitoSOL", assetClass: "crypto", imperialSymbol: null, pythLazerId: 458 },
  { symbol: "Crypto.HYPE/USD", label: "HYPE", assetClass: "crypto", imperialSymbol: "HYPE", pythLazerId: 110 },
  { symbol: "Crypto.ETH/USD", label: "Ether", assetClass: "crypto", imperialSymbol: "ETH", pythLazerId: 2 },
  { symbol: "Crypto.DOGE/USD", label: "DOGE", assetClass: "crypto", imperialSymbol: "DOGE", pythLazerId: 13 },
  { symbol: "Crypto.BTC/USD", label: "Bitcoin", assetClass: "crypto", imperialSymbol: "BTC", pythLazerId: 1 },
  { symbol: "Crypto.BNB/USD", label: "BNB", assetClass: "crypto", imperialSymbol: "BNB", pythLazerId: 15 },
];

export const DEFAULT_PYTH_SYMBOL = "Crypto.BTC/USD";

export const PYTH_SYMBOL_SET = new Set(PYTH_MARKET_SYMBOLS.map((item) => item.symbol));

export function isSupportedPythSymbol(symbol: string): boolean {
  return PYTH_SYMBOL_SET.has(symbol);
}

export function pythMarketBySymbol(symbol: string): PythMarketSymbol | undefined {
  return PYTH_MARKET_SYMBOLS.find((item) => item.symbol === symbol);
}

/** The 10-second Lever game is wired to the MagicBlock BTC market only. */
export function isLeverGameSymbol(symbol: string): boolean {
  return symbol === DEFAULT_PYTH_SYMBOL;
}

export function parsePythSymbolsParam(value: string | null): string[] {
  if (!value) return [DEFAULT_PYTH_SYMBOL];
  const symbols = [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];
  if (symbols.length === 0) return [DEFAULT_PYTH_SYMBOL];
  const unsupported = symbols.filter((symbol) => !isSupportedPythSymbol(symbol));
  if (unsupported.length > 0) {
    throw new Error(`Unsupported Pyth symbol: ${unsupported.join(", ")}`);
  }
  return symbols;
}

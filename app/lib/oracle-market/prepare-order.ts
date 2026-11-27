/**
 * Order preparation for oracle markets — PREPARATION ONLY.
 *
 * Builds the unsigned order intent a user's wallet would review and
 * sign in the browser. This layer never signs, never holds keys, and
 * never broadcasts; there is deliberately no submit path in this
 * module. An intent is refused (throws) when:
 * - the feature flag is off,
 * - the market is unknown,
 * - the reference quote is stale or unavailable (fail-closed: markets
 *   never trade on stale data), or
 * - confidential funding is requested but the Privacy Rings adapter
 *   cannot prepare it.
 */

import { oracleMarketById } from "./markets";
import type { OracleQuote } from "./pyth-client";
import {
  prepareConfidentialFunding,
  type PreparedPrivacyAction,
} from "./privacy-adapter";

export type OracleOrderKind = "spot" | "perps";
export type OracleSide = "buy" | "sell" | "long" | "short";

export interface OracleOrderIntent {
  kind: "oracle-order-intent";
  version: 1;
  marketId: string;
  symbol: string;
  orderKind: OracleOrderKind;
  side: OracleSide;
  /** Base-asset quantity the user asked for. */
  size: number;
  /** Perp leverage (1 for spot). Must not exceed the market cap. */
  leverage: number;
  /** Oracle reference price the intent was prepared against. */
  referencePrice: number;
  /** Unix seconds of the oracle bar behind referencePrice. */
  referenceBarTime: number;
  /** Funding source for collateral. */
  funding: "public" | "confidential";
  /** Collateral mint (USDC) the position would draw on. */
  collateralMint: string;
  /** Unix seconds after which the unsigned intent must not be signed. */
  expiresAt: number;
  /**
   * Present when funding is confidential: the prepared Privacy Rings
   * funding action (a deposit into the owner's private balance) that
   * the user's wallet completes. Prepared only — unsigned, unsubmitted.
   */
  confidentialFunding?: PreparedPrivacyAction;
}

const INTENT_TTL_SECONDS = 60;

export async function prepareOracleOrder(input: {
  marketId: string;
  orderKind: OracleOrderKind;
  side: OracleSide;
  size: number;
  leverage?: number;
  funding: "public" | "confidential";
  owner: string;
  collateralMint: string;
  collateralAmount: number;
  quote: OracleQuote;
  now?: number;
}): Promise<OracleOrderIntent> {
  if (process.env.ORACLE_MARKET_ENABLED !== "1") {
    throw new Error("Oracle markets are not enabled");
  }
  const market = oracleMarketById(input.marketId);
  if (!market) {
    throw new Error(`Unknown oracle market: ${input.marketId}`);
  }
  if (!Number.isFinite(input.size) || input.size <= 0) {
    throw new Error("Order size must be positive");
  }
  const leverage = input.orderKind === "spot" ? 1 : (input.leverage ?? 1);
  if (leverage < 1 || leverage > market.perps.maxLeverage) {
    throw new Error(
      `Leverage ${leverage} exceeds the ${market.symbol} cap of ${market.perps.maxLeverage}`,
    );
  }
  // Fail-closed: no preparation against a stale or missing price.
  if (
    input.quote.status !== "live" ||
    input.quote.price === null ||
    input.quote.barTime === null
  ) {
    throw new Error(
      `Market ${market.symbol} is halted: oracle price is ${input.quote.status}`,
    );
  }

  let confidentialFunding: PreparedPrivacyAction | undefined;
  if (input.funding === "confidential") {
    confidentialFunding = await prepareConfidentialFunding({
      owner: input.owner,
      collateralMint: input.collateralMint,
      amount: input.collateralAmount,
    });
  }

  const now = input.now ?? Math.floor(Date.now() / 1000);
  return {
    kind: "oracle-order-intent",
    version: 1,
    marketId: market.id,
    symbol: market.symbol,
    orderKind: input.orderKind,
    side: input.side,
    size: input.size,
    leverage,
    referencePrice: input.quote.price,
    referenceBarTime: input.quote.barTime,
    funding: input.funding,
    collateralMint: input.collateralMint,
    expiresAt: now + INTENT_TTL_SECONDS,
    ...(confidentialFunding ? { confidentialFunding } : {}),
  };
}

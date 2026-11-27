"use client";

import { useState } from "react";
import { BrandMark } from "@/app/components/brand-mark";
import { RouteNav } from "@/app/components/route-nav";
import { SessionIndicator } from "@/app/components/session-indicator";
import { useGameSession } from "@/app/hooks/use-game-session";
import { useGameWallet } from "@/app/hooks/use-game-wallet";
import { useOraclePrices } from "@/app/hooks/use-oracle-prices";
import {
  ORACLE_ASSET_CLASSES,
  ORACLE_MARKETS,
  type OracleAssetClass,
} from "@/app/lib/oracle-market/markets";
import {
  formatOraclePrice,
  oracleChangePercent,
  type OracleMarketView,
} from "@/app/lib/oracle-market/feed";

type OracleMode = "spot" | "perps";

function compactAddress(address: string): string {
  return address.length > 12
    ? `${address.slice(0, 4)}…${address.slice(-4)}`
    : address;
}

function formatBarTime(barTime: number | null): string {
  if (barTime === null) return "No print yet";
  return new Date(barTime * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OracleMarketPage() {
  const wallet = useGameWallet();
  const session = useGameSession();
  const feed = useOraclePrices();
  const [mode, setMode] = useState<OracleMode>("spot");

  const walletLabel = wallet.address
    ? compactAddress(wallet.address)
    : wallet.available
      ? wallet.connecting
        ? "Connecting…"
        : "Connect wallet"
      : "Wallet not found";

  const statusLabel = {
    disabled: "Not enabled",
    loading: "Loading",
    ready: "Live",
    stale: "Updating",
    unavailable: "Unavailable",
  }[feed.status];

  // When the feed is enabled the server payload is the source of truth;
  // when it is not, fall back to the static registry so the market list
  // still renders honestly, without prices.
  const rows: OracleMarketView[] =
    feed.payload?.markets ??
    ORACLE_MARKETS.map((market) => ({
      id: market.id,
      symbol: market.symbol,
      oracleSymbol: market.oracleSymbol,
      assetClass: market.assetClass,
      priceDecimals: market.priceDecimals,
      spot: market.spot,
      perps: market.perps,
      quote: null,
    }));

  return (
    <main className="app-shell oracle-shell">
      <header className="topbar">
        <div className="brand-area">
          <BrandMark />
          <RouteNav active="oracle" />
        </div>
        <div className="topbar-actions">
          <SessionIndicator
            active={session.ready}
            checking={session.busy && !session.ready}
            onRequestSetup={() => window.location.assign("/?session=setup")}
          />
          <button
            className="wallet"
            onClick={() => void wallet.connect()}
            disabled={wallet.connecting}
            type="button"
          >
            <span className={`dot ${wallet.address ? "is-connected" : ""}`} />
            <span className="wallet-label">{walletLabel}</span>
          </button>
        </div>
      </header>

      <div className="oracle-layout">
        <section className="oracle-hero">
          <div className="oracle-intro">
            <span className="eyebrow">Pyth fixed-rate oracle · 20 markets</span>
            <h1>Oracle markets</h1>
            <p>
              Spot and perps on metals, FX, equities, and crypto, priced by
              the Pyth fixed-rate feed. Collateral is funded from a
              confidential Privacy Rings balance, and every order is
              prepared here for your own wallet to sign — the site never
              signs or sends a trade for you.
            </p>
          </div>
          <div className="oracle-mode-card">
            <div className="oracle-toggle" role="tablist" aria-label="Market type">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "spot"}
                className={mode === "spot" ? "is-active" : ""}
                onClick={() => setMode("spot")}
              >
                Spot
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "perps"}
                className={mode === "perps" ? "is-active" : ""}
                onClick={() => setMode("perps")}
              >
                Perps
              </button>
            </div>
            <span className={`data-state ${feed.status}`}>{statusLabel}</span>
            <small>
              {feed.status === "disabled"
                ? "The oracle feed is not enabled yet. Markets are listed for reference; no prices are shown."
                : feed.status === "unavailable"
                  ? "The oracle feed is unreachable. Markets are halted rather than priced from old data."
                  : "A market whose newest print is too old shows as stale and is halted — it never trades on an old price."}
            </small>
          </div>
        </section>

        {feed.status === "unavailable" ? (
          <div className="oracle-error" role="status">
            <span>{feed.error ?? "Oracle feed unavailable"}</span>
            <button type="button" onClick={feed.retry}>
              Retry
            </button>
          </div>
        ) : null}

        {ORACLE_ASSET_CLASSES.map((group) => {
          const groupRows = rows.filter(
            (row) => row.assetClass === (group.id as OracleAssetClass),
          );
          if (groupRows.length === 0) return null;
          return (
            <section
              className="oracle-group"
              key={group.id}
              aria-labelledby={`oracle-group-${group.id}`}
            >
              <div className="oracle-section-heading">
                <div>
                  <h2 id={`oracle-group-${group.id}`}>{group.label}</h2>
                  <p>
                    {mode === "spot"
                      ? "Spot markets priced by Pyth."
                      : "Perpetual markets priced by Pyth. Leverage shown is the market cap."}
                  </p>
                </div>
                <span className="oracle-group-count">
                  {groupRows.length} markets
                </span>
              </div>
              <div className="oracle-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Market</th>
                      <th scope="col">Price</th>
                      <th scope="col">Change</th>
                      {mode === "perps" ? <th scope="col">Max leverage</th> : null}
                      <th scope="col">Feed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupRows.map((row) => {
                      const change = oracleChangePercent(row.quote);
                      const quoteStatus = row.quote?.status ?? "unavailable";
                      return (
                        <tr key={row.id}>
                          <td>
                            <span className="oracle-market-name">
                              {row.symbol}
                              <small>{row.oracleSymbol}</small>
                            </span>
                          </td>
                          <td className="num">
                            {formatOraclePrice(
                              row.quote?.price ?? null,
                              row.priceDecimals,
                            )}
                          </td>
                          <td
                            className={`num ${
                              change === null
                                ? ""
                                : change >= 0
                                  ? "positive"
                                  : "negative"
                            }`}
                          >
                            {change === null
                              ? "—"
                              : `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`}
                          </td>
                          {mode === "perps" ? (
                            <td className="num">{row.perps.maxLeverage}×</td>
                          ) : null}
                          <td>
                            <span className={`oracle-feed-state ${quoteStatus}`}>
                              {quoteStatus === "live"
                                ? "Live"
                                : quoteStatus === "stale"
                                  ? "Stale · halted"
                                  : "Halted"}
                            </span>
                            <small className="oracle-bar-time">
                              {formatBarTime(row.quote?.barTime ?? null)}
                            </small>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}

        <section className="oracle-privacy" aria-labelledby="oracle-privacy-title">
          <div className="oracle-section-heading">
            <div>
              <h2 id="oracle-privacy-title">Confidential funding</h2>
              <p>Collateral for these markets moves through Helius Privacy Rings.</p>
            </div>
          </div>
          <div className="oracle-privacy-grid">
            <div>
              <strong>Asset and amount stay hidden</strong>
              <span>
                A confidential balance does not publish what you hold or how
                much you move into a position.
              </span>
            </div>
            <div>
              <strong>Sender and recipient stay public</strong>
              <span>
                Privacy Rings are confidential, not anonymous — who funded a
                position is visible on-chain by design.
              </span>
            </div>
            <div>
              <strong>One Solana transaction</strong>
              <span>
                Confidential transfers settle natively on Solana in a single
                transaction, signed by your own wallet.
              </span>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

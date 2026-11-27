"use client";

import { useMemo, useState } from "react";
import type { PythImperialListing } from "@/app/lib/imperial/markets";
import {
  generateConfirmCode,
  postImperialOrderFromBrowser,
  submitImperialOrder,
  type ImperialSide,
} from "@/app/lib/imperial/orders";
import {
  clearImperialSessionToken,
  getImperialSessionToken,
  setImperialSessionToken,
} from "@/app/lib/imperial/session";

export function ImperialOrderPanel({
  listing,
  tradingEnabled,
  walletAddress,
}: {
  listing: PythImperialListing | null;
  tradingEnabled: boolean;
  walletAddress: string | null;
}) {
  const [token, setToken] = useState("");
  const [side, setSide] = useState<ImperialSide>("long");
  const [sizeUsd, setSizeUsd] = useState("10");
  const [collateralUsdc, setCollateralUsdc] = useState("2");
  const [leverage, setLeverage] = useState("5");
  const [confirm, setConfirm] = useState(false);
  const [confirmCode, setConfirmCode] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const expectedCode = useMemo(() => generateConfirmCode(), [listing?.pyth.symbol]);

  const tradeable = listing?.listing === "tradeable" && Boolean(listing.imperial);
  const canSubmit = tradingEnabled && tradeable && Boolean(walletAddress);

  const onSaveToken = () => {
    setImperialSessionToken(token);
    setStatus(token.trim() ? "Imperial token stored in this browser session only." : "Token cleared.");
  };

  const onSubmit = async () => {
    setStatus(null);
    try {
      const result = await submitImperialOrder({
        wallet: walletAddress ?? "",
        symbol: listing?.imperial?.symbol ?? listing?.pyth.imperialSymbol ?? "",
        side,
        action: "open",
        sizeUsd: Number(sizeUsd),
        collateralUsdc: Number(collateralUsdc),
        leverage: Number(leverage),
        confirm,
        confirmCode,
        expectedConfirmCode: expectedCode,
        sessionToken: getImperialSessionToken(),
        tradingEnabled,
      }, tradingEnabled ? postImperialOrderFromBrowser : undefined);
      setStatus(result.submitted
        ? "Order submitted to Imperial from this browser."
        : result.reason ?? "Ticket built but not submitted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Order was not submitted");
    }
  };

  return (
    <section className="aux-panel">
      <span className="eyebrow">Imperial perps</span>
      <h2>Gated order ticket</h2>
      {!tradeable ? (
        <p>This Pyth feed is price-only. There is no matching Imperial market to trade.</p>
      ) : null}
      {!tradingEnabled ? (
        <p>Imperial trading is disabled on this deployment. Tickets can be prepared, but nothing is sent.</p>
      ) : null}
      <label>
        Imperial login token
        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="Stays in this session only"
        />
      </label>
      <div className="panel-actions">
        <button type="button" className="quiet-button" onClick={onSaveToken}>Save in session</button>
        <button
          type="button"
          className="quiet-button"
          onClick={() => {
            setToken("");
            clearImperialSessionToken();
            setStatus("Token cleared.");
          }}
        >
          Clear
        </button>
      </div>
      <div className="panel-row">
        <label>
          Side
          <select value={side} onChange={(event) => setSide(event.target.value as ImperialSide)}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </label>
        <label>
          Size (USD)
          <input type="number" min="0" step="1" value={sizeUsd} onChange={(event) => setSizeUsd(event.target.value)} />
        </label>
      </div>
      <div className="panel-row">
        <label>
          Collateral (USDC)
          <input type="number" min="0" step="0.1" value={collateralUsdc} onChange={(event) => setCollateralUsdc(event.target.value)} />
        </label>
        <label>
          Leverage
          <input type="number" min="1" step="1" value={leverage} onChange={(event) => setLeverage(event.target.value)} />
        </label>
      </div>
      <p className="confirm-code">Type this confirm code: <strong>{expectedCode}</strong></p>
      <label>
        Confirm code
        <input value={confirmCode} onChange={(event) => setConfirmCode(event.target.value)} autoComplete="off" />
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={confirm} onChange={(event) => setConfirm(event.target.checked)} />
        I confirm this Imperial order. No builder or platform fee is added.
      </label>
      <button type="button" className="dialog-action" disabled={!canSubmit} onClick={() => void onSubmit()}>
        {tradingEnabled ? "Submit Imperial ticket" : "Trading disabled"}
      </button>
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}

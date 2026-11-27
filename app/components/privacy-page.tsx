"use client";

import { useMemo, useState } from "react";
import { BrandMark } from "@/app/components/brand-mark";
import { RouteNav } from "@/app/components/route-nav";
import { useGameWallet } from "@/app/hooks/use-game-wallet";
import {
  PRIVACY_ASSETS,
  type PrivacyActionKind,
} from "@/app/lib/privacy/constants";
import type {
  PreparedPrivacyAction,
  PrivateBalanceRead,
  PrivateHistoryRead,
} from "@/app/lib/privacy/types";

const UI_ENABLED =
  process.env.NEXT_PUBLIC_PRIVACY_RINGS_ENABLED === "1" ||
  process.env.NEXT_PUBLIC_PRIVACY_RINGS_ENABLED === "true";

function compact(value: string): string {
  return value.length > 12 ? `${value.slice(0, 4)}…${value.slice(-4)}` : value;
}

type ReadState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: T }
  | { status: "error"; message: string };

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body = (await response.json().catch(() => null)) as
    | T
    | { error?: string }
    | null;
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }
  return body as T;
}

export function PrivacyPage() {
  const wallet = useGameWallet();
  const connected = wallet.address !== null;

  const [tagInput, setTagInput] = useState("");
  const viewTag = tagInput.trim() || wallet.address || "";

  const [balance, setBalance] = useState<ReadState<PrivateBalanceRead>>({
    status: "idle",
  });
  const [history, setHistory] = useState<ReadState<PrivateHistoryRead>>({
    status: "idle",
  });

  const [kind, setKind] = useState<PrivacyActionKind>("deposit");
  const [assetMint, setAssetMint] = useState(PRIVACY_ASSETS[1].mint);
  const [customMint, setCustomMint] = useState("");
  const [amount, setAmount] = useState("");
  const [recipient, setRecipient] = useState("");
  const [prepared, setPrepared] = useState<PreparedPrivacyAction | null>(null);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const mint = customMint.trim() || assetMint;
  const asset = useMemo(
    () => PRIVACY_ASSETS.find((a) => a.mint === mint) ?? null,
    [mint],
  );

  const walletLabel = wallet.connecting
    ? "Connecting…"
    : connected
      ? compact(wallet.address!)
      : "Connect wallet";

  async function readBalance() {
    if (!viewTag) return;
    setBalance({ status: "loading" });
    try {
      const data = await fetchJson<PrivateBalanceRead>(
        `/api/privacy/balance?tag=${encodeURIComponent(viewTag)}`,
      );
      setBalance({ status: "ready", data });
    } catch (error) {
      setBalance({
        status: "error",
        message: error instanceof Error ? error.message : "Read failed",
      });
    }
  }

  async function readHistory() {
    if (!viewTag) return;
    setHistory({ status: "loading" });
    try {
      const data = await fetchJson<PrivateHistoryRead>(
        `/api/privacy/history?tag=${encodeURIComponent(viewTag)}&limit=25`,
      );
      setHistory({ status: "ready", data });
    } catch (error) {
      setHistory({
        status: "error",
        message: error instanceof Error ? error.message : "Read failed",
      });
    }
  }

  async function prepare() {
    if (!wallet.address) return;
    setPreparing(true);
    setPrepareError(null);
    setPrepared(null);
    try {
      const data = await fetchJson<PreparedPrivacyAction>(
        "/api/privacy/prepare",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            owner: wallet.address,
            recipient: kind === "transfer" ? recipient.trim() : null,
            mint,
            amount: amount.trim(),
          }),
        },
      );
      setPrepared(data);
    } catch (error) {
      setPrepareError(
        error instanceof Error ? error.message : "Preparation failed",
      );
    } finally {
      setPreparing(false);
    }
  }

  const prepareDisabled =
    !UI_ENABLED ||
    !connected ||
    preparing ||
    amount.trim() === "" ||
    (kind === "transfer" && recipient.trim() === "");

  return (
    <main className="app-shell privacy-shell">
      <header className="topbar">
        <div className="brand-area">
          <BrandMark />
          <RouteNav active="privacy" />
        </div>
        <div className="topbar-actions">
          <button
            className="wallet"
            onClick={() => void wallet.connect()}
            disabled={wallet.connecting}
            type="button"
          >
            <span className={`dot ${connected ? "is-connected" : ""}`} />
            <span className="wallet-label">{walletLabel}</span>
          </button>
        </div>
      </header>

      <div className="privacy-scroll">
        <div className="privacy-layout">
          <section className="privacy-intro">
            <span className="eyebrow">Helius Privacy Rings</span>
            <h1>Confidential collateral</h1>
            <p>
              Hold a private balance and fund Lever positions from it. The
              funding stays confidential — the asset and amount are hidden,
              while sender and recipient stay public.
            </p>
          </section>

          {!UI_ENABLED ? (
            <p className="privacy-notice" role="status">
              Privacy Rings are not enabled on this deployment yet. The panel
              below shows how confidential funding will work; balances,
              history, and preparation stay off until the owner enables it.
            </p>
          ) : null}

          <section className="privacy-card" aria-labelledby="privacy-how-title">
            <h2 id="privacy-how-title">How it works</h2>
            <p className="privacy-sub">
              Programmable privacy, settled natively on Solana.
            </p>
            <ul className="privacy-facts">
              <li>
                <strong>Confidential, not anonymous</strong>
                <span>
                  Asset and amount stay hidden. Sender and recipient stay
                  public, and every action settles in one Solana transaction.
                </span>
              </li>
              <li>
                <strong>Self-custodial</strong>
                <span>
                  Spending always requires your wallet&apos;s signature. Lever
                  never holds keys and never signs for you.
                </span>
              </li>
              <li>
                <strong>Private balance, public positions</strong>
                <span>
                  Deposit SOL, USDC, or another supported asset into a private
                  balance, then fund positions without publishing the amount.
                </span>
              </li>
            </ul>
          </section>

          <section className="privacy-card" aria-labelledby="privacy-balance-title">
            <h2 id="privacy-balance-title">Private balance</h2>
            <p className="privacy-sub">
              Reads go through Lever&apos;s server to the Helius privacy
              indexer. The indexer returns encrypted outputs only — amounts
              decrypt in your wallet, never on a server.
            </p>
            <div className="privacy-row">
              <div className="privacy-grow">
                <label className="privacy-field-label" htmlFor="privacy-tag">
                  View tag
                </label>
                <input
                  id="privacy-tag"
                  className="privacy-input num"
                  placeholder={
                    connected
                      ? (wallet.address ?? "")
                      : "Connect a wallet or paste a view tag"
                  }
                  value={tagInput}
                  onChange={(event) => setTagInput(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
              <button
                className="privacy-button"
                type="button"
                disabled={!UI_ENABLED || !viewTag || balance.status === "loading"}
                onClick={() => void readBalance()}
              >
                {balance.status === "loading" ? "Reading…" : "Read balance"}
              </button>
              <button
                className="privacy-button"
                type="button"
                disabled={!UI_ENABLED || !viewTag || history.status === "loading"}
                onClick={() => void readHistory()}
              >
                {history.status === "loading" ? "Reading…" : "Read history"}
              </button>
            </div>

            {balance.status === "error" ? (
              <p className="privacy-error" role="alert">
                {balance.message}
              </p>
            ) : null}
            {balance.status === "ready" ? (
              <>
                <div className="privacy-metrics">
                  <div>
                    <span>Encrypted outputs</span>
                    <strong className="num">{balance.data.outputCount}</strong>
                  </div>
                  <div>
                    <span>Transactions</span>
                    <strong className="num">
                      {balance.data.transactions.length}
                    </strong>
                  </div>
                  <div>
                    <span>Indexer slot</span>
                    <strong className="num">{balance.data.contextSlot}</strong>
                  </div>
                </div>
                {balance.data.outputCount === 0 ? (
                  <p className="privacy-empty">
                    No encrypted outputs for this view tag yet. A confidential
                    deposit creates the first one.
                  </p>
                ) : (
                  <ul className="privacy-list">
                    {balance.data.transactions.flatMap((tx) =>
                      tx.outputs.map((output) => (
                        <li
                          key={`${output.outputSlot.outputContext.hash}-${output.outputSlot.outputContext.leafIndex}`}
                        >
                          <span className="num">
                            {compact(output.outputSlot.outputContext.hash)}
                          </span>
                          <span className="privacy-meta num">
                            Tree {output.outputSlot.outputContext.treeId} ·
                            leaf {output.outputSlot.outputContext.leafIndex} ·
                            slot {tx.slot}
                          </span>
                        </li>
                      )),
                    )}
                  </ul>
                )}
                <p className="privacy-guard">
                  Amounts are encrypted in every output above. Only the
                  wallet holding the viewing key can decrypt them.
                </p>
              </>
            ) : null}

            {history.status === "error" ? (
              <p className="privacy-error" role="alert">
                {history.message}
              </p>
            ) : null}
            {history.status === "ready" ? (
              <>
                <h2 style={{ marginTop: 20 }}>Private history</h2>
                <p className="privacy-sub">
                  Public parts only: slot, signature, and event counts.
                </p>
                {history.data.entries.length === 0 ? (
                  <p className="privacy-empty">
                    No shielded transactions for this view tag yet.
                  </p>
                ) : (
                  <ul className="privacy-list">
                    {history.data.entries.map((entry) => (
                      <li key={entry.signature}>
                        <span className="num">{compact(entry.signature)}</span>
                        <span className="privacy-meta num">
                          Slot {entry.slot} · {entry.outputCount} outputs ·{" "}
                          {entry.nullifierCount} nullifiers
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : null}
          </section>

          <section className="privacy-card" aria-labelledby="privacy-prepare-title">
            <h2 id="privacy-prepare-title">Deposit, transfer, withdraw</h2>
            <p className="privacy-sub">
              Preparation only. Lever assembles the action; your wallet
              builds, reviews, and signs the transaction. Nothing is signed
              or submitted here.
            </p>

            <div className="privacy-tabs" role="tablist" aria-label="Privacy action">
              {(["deposit", "transfer", "withdraw"] as const).map((value) => (
                <button
                  key={value}
                  className={kind === value ? "is-active" : ""}
                  onClick={() => setKind(value)}
                  role="tab"
                  aria-selected={kind === value}
                  type="button"
                >
                  {value === "deposit"
                    ? "Deposit"
                    : value === "transfer"
                      ? "Transfer"
                      : "Withdraw"}
                </button>
              ))}
            </div>

            <span className="privacy-field-label">Asset</span>
            <div className="privacy-chips" role="group" aria-label="Asset">
              {PRIVACY_ASSETS.map((a) => (
                <button
                  key={a.mint}
                  type="button"
                  className={
                    !customMint.trim() && assetMint === a.mint
                      ? "is-active"
                      : ""
                  }
                  onClick={() => {
                    setAssetMint(a.mint);
                    setCustomMint("");
                  }}
                >
                  {a.symbol}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 16 }}>
              <label className="privacy-field-label" htmlFor="privacy-mint">
                Mint (custom overrides the chips)
              </label>
              <input
                id="privacy-mint"
                className="privacy-input num"
                placeholder={assetMint}
                value={customMint}
                onChange={(event) => setCustomMint(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            {kind === "transfer" ? (
              <div style={{ marginBottom: 16 }}>
                <label
                  className="privacy-field-label"
                  htmlFor="privacy-recipient"
                >
                  Recipient
                </label>
                <input
                  id="privacy-recipient"
                  className="privacy-input num"
                  placeholder="Recipient Solana address"
                  value={recipient}
                  onChange={(event) => setRecipient(event.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            ) : null}

            <label className="privacy-field-label" htmlFor="privacy-amount">
              Amount{asset ? ` (${asset.symbol})` : ""}
            </label>
            <div className="privacy-amount">
              <input
                id="privacy-amount"
                className="num"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
              <b>{asset?.symbol ?? "tokens"}</b>
            </div>

            {!connected ? (
              <p className="privacy-notice" role="status" style={{ marginTop: 16 }}>
                Connect a wallet to prepare an action. Preparation stays
                disabled until then.
              </p>
            ) : null}

            <button
              className="privacy-submit"
              type="button"
              disabled={prepareDisabled}
              onClick={() => void prepare()}
            >
              {preparing
                ? "Preparing…"
                : kind === "deposit"
                  ? "Prepare deposit"
                  : kind === "transfer"
                    ? "Prepare transfer"
                    : "Prepare withdrawal"}
            </button>
            <p className="privacy-guard">
              Prepared actions are never submitted from this page. Your
              wallet signs in your browser when you choose to proceed.
            </p>

            {prepareError ? (
              <p className="privacy-error" role="alert">
                {prepareError}
              </p>
            ) : null}
            {prepared ? (
              <div className="privacy-prepared" aria-live="polite">
                <dl>
                  <div>
                    <dt>Action</dt>
                    <dd>
                      {prepared.kind} · {prepared.amountDisplay}{" "}
                      {prepared.assetSymbol ?? ""}
                    </dd>
                  </div>
                  <div>
                    <dt>Amount (minor units)</dt>
                    <dd className="num">{prepared.amountMinor}</dd>
                  </div>
                  <div>
                    <dt>Owner</dt>
                    <dd className="num">{compact(prepared.owner)}</dd>
                  </div>
                  {prepared.recipient ? (
                    <div>
                      <dt>Recipient</dt>
                      <dd className="num">{compact(prepared.recipient)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Interface PDA</dt>
                    <dd className="num">
                      {prepared.interfacePda
                        ? compact(prepared.interfacePda)
                        : "Not published for this mint"}
                    </dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {prepared.status === "prepared"
                        ? "Prepared — not submitted"
                        : "Interface setup required first"}
                    </dd>
                  </div>
                </dl>
                <ol>
                  {prepared.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p>{prepared.note}</p>
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import {
  decryptPrivateBalance,
  deriveConfidentialViewTag,
  isDocsExampleViewTag,
  type EncryptedUtxoPage,
  type PrivateBalanceSummary,
} from "@/app/lib/helius/privacy";

export function PrivateBalancePanel({ walletAddress }: { walletAddress: string | null }) {
  const [page, setPage] = useState<EncryptedUtxoPage | null>(null);
  const [summary, setSummary] = useState<PrivateBalanceSummary | null>(null);
  const [viewingKey, setViewingKey] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!walletAddress) {
      setStatus("Connect a wallet to derive its confidential view tag.");
      return;
    }
    const tag = deriveConfidentialViewTag(walletAddress);
    if (isDocsExampleViewTag(tag)) {
      setStatus("Refusing to use a documentation example tag as the wallet tag.");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/helius/encrypted-utxos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: [tag] }),
      });
      const body = await response.json() as EncryptedUtxoPage & { error?: string };
      if (!response.ok) throw new Error(body.error ?? "Private balance proxy failed");
      setPage(body);
      setSummary(decryptPrivateBalance({ viewingKey, page: body }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Private balance read failed");
    } finally {
      setBusy(false);
    }
  };

  const decrypt = () => {
    if (!page) return;
    setSummary(decryptPrivateBalance({ viewingKey, page }));
  };

  return (
    <section className="aux-panel">
      <span className="eyebrow">Helius Privacy Rings</span>
      <h2>Private USDC reader</h2>
      <p>Devnet encrypted UTXOs are fetched through a server proxy. Decryption stays in the browser.</p>
      <label>
        Viewing key (optional, never uploaded)
        <input
          type="password"
          autoComplete="off"
          value={viewingKey}
          onChange={(event) => setViewingKey(event.target.value)}
        />
      </label>
      <div className="panel-actions">
        <button type="button" className="quiet-button" disabled={busy} onClick={() => void load()}>
          {busy ? "Loading…" : "Fetch encrypted outputs"}
        </button>
        <button type="button" className="quiet-button" disabled={!page} onClick={decrypt}>
          Decrypt locally
        </button>
      </div>
      {summary ? (
        <p>
          {summary.decrypted
            ? `Spendable: ${summary.spendable.map((item) => `${item.asset} ${item.amount}`).join(", ") || "0"}`
            : `${summary.outputCount} encrypted output(s). ${summary.reason}`}
        </p>
      ) : null}
      {status ? <p role="status">{status}</p> : null}
    </section>
  );
}

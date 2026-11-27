"use client";

import { useEffect, useMemo, useState } from "react";
import type { PythImperialListing } from "@/app/lib/imperial/markets";
import type { PythHistoryBar, PythLatestPrice } from "@/app/lib/pyth/server";
import { DEFAULT_PYTH_SYMBOL } from "@/app/lib/pyth/symbols";

export function usePythMarket(symbol: string) {
  const [listings, setListings] = useState<PythImperialListing[]>([]);
  const [price, setPrice] = useState<PythLatestPrice | null>(null);
  const [bars, setBars] = useState<PythHistoryBar[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [tradingEnabled, setTradingEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [marketResponse, statusResponse] = await Promise.all([
          fetch("/api/imperial/markets", { cache: "no-store" }),
          fetch("/api/imperial/status", { cache: "no-store" }),
        ]);
        const marketBody = await marketResponse.json() as { listings?: PythImperialListing[]; error?: string };
        const statusBody = await statusResponse.json() as { tradingEnabled?: boolean };
        if (cancelled) return;
        if (!marketResponse.ok) throw new Error(marketBody.error ?? "Imperial markets failed");
        setListings(marketBody.listings ?? []);
        setTradingEnabled(Boolean(statusBody.tradingEnabled));
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Market list failed");
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [latest, history] = await Promise.all([
          fetch(`/api/pyth/latest?symbols=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
          fetch(`/api/pyth/history?symbol=${encodeURIComponent(symbol)}`, { cache: "no-store" }),
        ]);
        const latestBody = await latest.json() as { prices?: PythLatestPrice[]; error?: string };
        const historyBody = await history.json() as { bars?: PythHistoryBar[]; error?: string };
        if (cancelled) return;
        if (!latest.ok) throw new Error(latestBody.error ?? "Pyth latest price failed");
        setPrice(latestBody.prices?.[0] ?? null);
        if (history.ok) setBars(historyBody.bars ?? []);
        setError(null);
      } catch (cause) {
        if (!cancelled) setError(cause instanceof Error ? cause.message : "Pyth price failed");
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 2_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [symbol]);

  useEffect(() => {
    const source = new EventSource(`/api/pyth/stream?symbols=${encodeURIComponent(symbol)}`);
    source.onmessage = (event) => {
      try {
        const body = JSON.parse(event.data) as { prices?: PythLatestPrice[] };
        const next = body.prices?.[0];
        if (next) setPrice(next);
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => {
      source.close();
    };
    return () => source.close();
  }, [symbol]);

  const listing = useMemo(
    () => listings.find((item) => item.pyth.symbol === symbol) ?? null,
    [listings, symbol],
  );

  return {
    symbol: symbol || DEFAULT_PYTH_SYMBOL,
    listings,
    listing,
    price,
    bars,
    error,
    tradingEnabled,
  };
}

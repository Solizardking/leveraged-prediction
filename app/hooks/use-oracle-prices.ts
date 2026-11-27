"use client";

import { useEffect, useState } from "react";
import {
  fetchOraclePrices,
  OracleFeedDisabledError,
  type OraclePricesPayload,
} from "@/app/lib/oracle-market/feed";

export type OraclePricesStatus =
  | "disabled"
  | "loading"
  | "ready"
  | "stale"
  | "unavailable";

const POLL_INTERVAL_MS = 15_000;

interface OraclePricesState {
  payload: OraclePricesPayload | null;
  status: "ready" | "stale" | "unavailable";
  error: string | null;
}

export function useOraclePrices() {
  const [generation, setGeneration] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const [state, setState] = useState<OraclePricesState | null>(null);

  useEffect(() => {
    if (disabled) return;
    let cancelled = false;
    const controller = new AbortController();

    const load = async () => {
      try {
        const payload = await fetchOraclePrices(controller.signal);
        if (cancelled) return;
        setState((previous) => ({
          payload,
          status:
            previous?.payload && payload.generatedAt === previous.payload.generatedAt
              ? "stale"
              : "ready",
          error: null,
        }));
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        if (cause instanceof OracleFeedDisabledError) {
          setDisabled(true);
          return;
        }
        setState((previous) => ({
          payload: previous?.payload ?? null,
          status: previous?.payload ? "stale" : "unavailable",
          error: cause instanceof Error ? cause.message : "Oracle feed failed",
        }));
      }
    };

    void load();
    const interval = setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(interval);
    };
  }, [generation, disabled]);

  const status: OraclePricesStatus = disabled
    ? "disabled"
    : state === null
      ? "loading"
      : state.status;

  return {
    status,
    payload: state?.payload ?? null,
    error: state?.error ?? null,
    retry: () => setGeneration((value) => value + 1),
  };
}

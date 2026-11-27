import { describe, expect, it } from "vitest";
import { isRetryableSnapshotError, withRetries } from "@/app/lib/live/snapshot-retry";
import { fetchMarketSnapshot } from "@/app/lib/live/snapshot-client";

describe("snapshot retries", () => {
  it("retries stale-oracle failures and then succeeds", async () => {
    let attempts = 0;
    const value = await withRetries(async () => {
      attempts += 1;
      if (attempts < 3) throw new Error("Oracle update is stale or invalid (-2.0s old)");
      return "ok";
    }, { delayMs: 0 });
    expect(value).toBe("ok");
    expect(attempts).toBe(3);
  });

  it("does not retry unrelated failures", async () => {
    let attempts = 0;
    await expect(withRetries(async () => {
      attempts += 1;
      throw new Error("Market 1 is not initialized on base");
    }, { delayMs: 0 })).rejects.toThrow(/not initialized/);
    expect(attempts).toBe(1);
  });

  it("retries client snapshot fetches on LIVE_UNAVAILABLE", async () => {
    let attempts = 0;
    const fetchImpl = async () => {
      attempts += 1;
      if (attempts === 1) {
        return new Response(JSON.stringify({
          code: "LIVE_UNAVAILABLE",
          error: "Oracle update is stale or invalid (-2.0s old)",
        }), { status: 503, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({
        mode: "live",
        marketId: 1,
        currentPrice: 1,
        priceHistory: [],
        plays: [],
      }), { status: 200, headers: { "content-type": "application/json" } });
    };
    const snapshot = await fetchMarketSnapshot(null, fetchImpl as typeof fetch);
    expect(snapshot.mode).toBe("live");
    expect(attempts).toBe(2);
    expect(isRetryableSnapshotError("LIVE_UNAVAILABLE")).toBe(true);
  });
});

import type { MarketSnapshot, SnapshotError } from "@/app/lib/domain";
import { isRetryableSnapshotError, withRetries } from "@/app/lib/live/snapshot-retry";

export async function fetchMarketSnapshot(
  walletAddress: string | null,
  fetchImpl: typeof fetch = fetch,
): Promise<MarketSnapshot> {
  return withRetries(async () => {
    const query = walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : "";
    const response = await fetchImpl(`/api/snapshot${query}`, { cache: "no-store" });
    const body = (await response.json()) as MarketSnapshot | SnapshotError;
    if (!response.ok || "error" in body) {
      throw new Error("error" in body ? body.error : `Snapshot failed (${response.status})`);
    }
    return body;
  }, {
    isRetryable: (error) => error instanceof Error && isRetryableSnapshotError(error.message),
  });
}

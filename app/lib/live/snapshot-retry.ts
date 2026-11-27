export const SNAPSHOT_RETRY_ATTEMPTS = 3;
export const SNAPSHOT_RETRY_DELAY_MS = 300;

export function isRetryableSnapshotError(message: string): boolean {
  return /stale or invalid|LIVE_UNAVAILABLE|Live snapshot failed/i.test(message);
}

export async function withRetries<T>(
  run: () => Promise<T>,
  options?: {
    attempts?: number;
    delayMs?: number;
    sleep?: (ms: number) => Promise<void>;
    isRetryable?: (error: unknown) => boolean;
  },
): Promise<T> {
  const attempts = options?.attempts ?? SNAPSHOT_RETRY_ATTEMPTS;
  const delayMs = options?.delayMs ?? SNAPSHOT_RETRY_DELAY_MS;
  const sleep = options?.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
  const isRetryable = options?.isRetryable ?? ((error: unknown) =>
    error instanceof Error && isRetryableSnapshotError(error.message));

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isRetryable(error)) throw error;
      await sleep(delayMs * attempt);
    }
  }
  throw lastError;
}

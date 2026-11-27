import { NextRequest, NextResponse } from "next/server";
import type { SnapshotError } from "@/app/lib/domain";
import { readLiveSnapshot } from "@/app/lib/live/read-snapshot";
import { isRetryableSnapshotError, withRetries } from "@/app/lib/live/snapshot-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const wallet = request.nextUrl.searchParams.get("wallet") ?? undefined;
    const snapshot = await withRetries(
      () => readLiveSnapshot(wallet),
      {
        isRetryable: (error) =>
          error instanceof Error && isRetryableSnapshotError(error.message),
      },
    );
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const body: SnapshotError = {
      code: "LIVE_UNAVAILABLE",
      error: error instanceof Error ? error.message : "Live snapshot failed",
    };
    return NextResponse.json(body, { status: 503 });
  }
}

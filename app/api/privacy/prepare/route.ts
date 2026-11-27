import { NextRequest, NextResponse } from "next/server";
import { isPrivacyRingsEnabled } from "@/app/lib/privacy/config";
import {
  PrivacyPrepareError,
  preparePrivacyAction,
} from "@/app/lib/privacy/prepare";
import type { PrivacyActionKind } from "@/app/lib/privacy/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Prepares a Privacy Rings action (deposit / transfer / withdraw) for the
// caller's wallet to complete. Preparation only: this route never signs,
// never submits, and holds no keys. Signing stays in the user's wallet.
export async function POST(request: NextRequest) {
  if (!isPrivacyRingsEnabled()) {
    return NextResponse.json(
      { code: "PRIVACY_DISABLED", error: "Privacy Rings are not enabled" },
      { status: 503 },
    );
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "Request body must be JSON" },
      { status: 400 },
    );
  }
  const input = (body ?? {}) as Record<string, unknown>;
  const kind = input.kind;
  if (kind !== "deposit" && kind !== "transfer" && kind !== "withdraw") {
    return NextResponse.json(
      { code: "BAD_REQUEST", error: "kind must be deposit, transfer, or withdraw" },
      { status: 400 },
    );
  }
  try {
    const prepared = preparePrivacyAction({
      kind: kind as PrivacyActionKind,
      owner: String(input.owner ?? ""),
      recipient:
        typeof input.recipient === "string" ? input.recipient : null,
      mint: String(input.mint ?? ""),
      amount: String(input.amount ?? ""),
    });
    return NextResponse.json(prepared, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    if (error instanceof PrivacyPrepareError) {
      return NextResponse.json(
        { code: "PREPARE_FAILED", error: error.message },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { code: "PREPARE_FAILED", error: "Preparation failed" },
      { status: 500 },
    );
  }
}

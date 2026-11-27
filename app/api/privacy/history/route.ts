import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { readPrivateHistory } from "@/app/lib/privacy/client";
import {
  PrivacyConfigError,
  isPrivacyRingsEnabled,
} from "@/app/lib/privacy/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Recent shielded history for one view tag. Entries expose only the public
// parts of each transaction (slot, signature, output/nullifier counts);
// amounts and assets stay encrypted for the owner's wallet to decrypt.
export async function GET(request: NextRequest) {
  if (!isPrivacyRingsEnabled()) {
    return NextResponse.json(
      { code: "PRIVACY_DISABLED", error: "Privacy Rings are not enabled" },
      { status: 503 },
    );
  }
  const tag = request.nextUrl.searchParams.get("tag") ?? "";
  try {
    new PublicKey(tag);
  } catch {
    return NextResponse.json(
      { code: "BAD_TAG", error: "tag must be a Solana public key" },
      { status: 400 },
    );
  }
  const rawLimit = Number(request.nextUrl.searchParams.get("limit") ?? "25");
  const limit = Number.isInteger(rawLimit)
    ? Math.min(100, Math.max(1, rawLimit))
    : 25;
  try {
    return NextResponse.json(await readPrivateHistory(tag, limit), {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const code =
      error instanceof PrivacyConfigError
        ? "PRIVACY_UNAVAILABLE"
        : "PRIVACY_READ_FAILED";
    return NextResponse.json(
      {
        code,
        error:
          error instanceof Error ? error.message : "Private history read failed",
      },
      { status: 503 },
    );
  }
}

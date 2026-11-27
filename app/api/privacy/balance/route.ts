import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { readPrivateBalance } from "@/app/lib/privacy/client";
import {
  PrivacyConfigError,
  isPrivacyRingsEnabled,
} from "@/app/lib/privacy/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Reads a wallet's encrypted Privacy Rings outputs for one view tag. In
// confidential rings the view tag is the owner's Solana public key. The
// response carries ciphertext only — amounts decrypt in the owner's wallet.
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
  try {
    return NextResponse.json(await readPrivateBalance(tag), {
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
          error instanceof Error ? error.message : "Private balance read failed",
      },
      { status: 503 },
    );
  }
}

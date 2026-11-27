/**
 * Privacy Rings adapter for oracle-market collateral.
 *
 * Oracle-market positions are funded from a confidential Privacy Rings
 * balance: the asset and amount stay hidden, the sender and recipient
 * stay public, and settlement lands in a single Solana transaction.
 * (Confidential — never "anonymous": the parties to a transfer are
 * visible on-chain by design.)
 *
 * This adapter binds the oracle market to the repo's Privacy Rings
 * module (app/lib/privacy), which is the source of truth for the SPR
 * surface:
 * - Funding a position = preparePositionFunding: a deposit of the
 *   collateral asset into the owner's own private balance.
 * - Balance reads go by view tag through readPrivateBalance and return
 *   encrypted state only — amounts are never decrypted server-side.
 * - Funding verification (credit a position only on proof) lives in
 *   app/lib/privacy/funding.ts (assessConfidentialFunding) and stays
 *   fail-closed there.
 *
 * Everything here is gated by PRIVACY_RINGS_ENABLED via the privacy
 * module's own isPrivacyRingsEnabled(). When the flag is off, reads
 * report an unavailable (never fresh) balance and preparations throw —
 * no oracle position can be treated as confidentially funded.
 *
 * Preparation only: a prepared action is a descriptor the user's own
 * wallet completes with the SPR SDK. Nothing here signs, holds keys,
 * or broadcasts.
 */

import { isPrivacyRingsEnabled } from "@/app/lib/privacy/config";
import { readPrivateBalance } from "@/app/lib/privacy/client";
import {
  preparePositionFunding,
  preparePrivacyAction,
  type PreparedPrivacyAction,
} from "@/app/lib/privacy/prepare";

export type { PreparedPrivacyAction };

export interface ConfidentialBalanceView {
  /** Base58 view tag the balance was read for. */
  viewTag: string;
  /** Encrypted outputs currently attributed to the tag. */
  outputCount: number;
  /** Indexer context slot of the read. */
  contextSlot: number;
  /**
   * True only when the balance was read fresh from the privacy surface.
   * False whenever the module is disabled or the read failed — callers
   * must never treat a non-fresh view as a funded balance.
   */
  fresh: boolean;
}

const DISABLED =
  "Privacy Rings are disabled (PRIVACY_RINGS_ENABLED is off). Confidential funding is unavailable; no position can be funded this way.";

export function privacyRingsEnabled(): boolean {
  return isPrivacyRingsEnabled();
}

/**
 * Read the confidential balance shape for a view tag. Amounts are
 * hidden by design: the privacy module returns encrypted outputs, and
 * decryption happens only in the owner's wallet.
 */
export async function readConfidentialBalance(
  viewTag: string,
): Promise<ConfidentialBalanceView> {
  if (!isPrivacyRingsEnabled()) {
    return { viewTag, outputCount: 0, contextSlot: 0, fresh: false };
  }
  try {
    const read = await readPrivateBalance(viewTag);
    return {
      viewTag: read.viewTag,
      outputCount: read.outputCount,
      contextSlot: read.contextSlot,
      fresh: true,
    };
  } catch {
    // Fail closed: a failed read is an unavailable balance, never a
    // partial or assumed one.
    return { viewTag, outputCount: 0, contextSlot: 0, fresh: false };
  }
}

/**
 * Prepare the confidential funding leg for an oracle position: deposit
 * `amount` (whole units) of the collateral mint into the owner's
 * private balance. Throws when Privacy Rings are disabled or the
 * prepared action is not ready to be signed (e.g. the mint has no
 * interface PDA yet).
 */
export async function prepareConfidentialFunding(input: {
  owner: string;
  collateralMint: string;
  amount: number;
}): Promise<PreparedPrivacyAction> {
  if (!isPrivacyRingsEnabled()) {
    throw new Error(DISABLED);
  }
  const prepared = preparePositionFunding({
    owner: input.owner,
    collateralMint: input.collateralMint,
    amount: String(input.amount),
  });
  if (prepared.status !== "prepared") {
    throw new Error(
      `Confidential funding is not ready for this asset: ${prepared.note}`,
    );
  }
  return prepared;
}

/** Prepare a confidential transfer between two confidential balances. */
export async function prepareConfidentialTransfer(input: {
  owner: string;
  recipient: string;
  mint: string;
  amount: number;
}): Promise<PreparedPrivacyAction> {
  if (!isPrivacyRingsEnabled()) {
    throw new Error(DISABLED);
  }
  const prepared = preparePrivacyAction({
    kind: "transfer",
    owner: input.owner,
    recipient: input.recipient,
    mint: input.mint,
    amount: String(input.amount),
  });
  if (prepared.status !== "prepared") {
    throw new Error(
      `Confidential transfer is not ready for this asset: ${prepared.note}`,
    );
  }
  return prepared;
}

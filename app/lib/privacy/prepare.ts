// Transaction-preparation layer for Privacy Rings actions.
//
// Preparation is pure: it validates inputs and assembles everything the
// user's wallet needs to build the real transaction with the SPR SDK
// (@heliuslabs/spr) — owner, asset, amount, program, and the mint's SPL
// interface PDA. It never signs, never submits, and never touches a key.
// The server holds no keys; signing stays in the user's own wallet in the
// browser, and each confidential action settles in one Solana transaction.

import { PublicKey } from "@solana/web3.js";
import {
  PRIVACY_PROGRAM_ID,
  privacyAssetForMint,
  type PrivacyActionKind,
} from "@/app/lib/privacy/constants";
import type { PreparedPrivacyAction } from "@/app/lib/privacy/types";

export class PrivacyPrepareError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyPrepareError";
  }
}

function requirePublicKey(value: string, field: string): string {
  try {
    return new PublicKey(value).toBase58();
  } catch {
    throw new PrivacyPrepareError(`${field} must be a Solana public key`);
  }
}

/** Parse a decimal amount string into minor units without floating point. */
export function parseAmountToMinor(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new PrivacyPrepareError("Amount must be a positive decimal number");
  }
  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new PrivacyPrepareError(
      `Amount supports at most ${decimals} decimal places for this asset`,
    );
  }
  const minor =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (minor <= 0n) {
    throw new PrivacyPrepareError("Amount must be greater than zero");
  }
  return minor;
}

export interface PreparePrivacyActionInput {
  kind: PrivacyActionKind;
  /** The funding wallet. Always the signer; always the user's own wallet. */
  owner: string;
  /** Required for transfers; ignored for deposits and withdrawals. */
  recipient?: string | null;
  mint: string;
  /** Decimal amount in whole units, e.g. "25.00". */
  amount: string;
}

const WALLET_STEPS: Record<PrivacyActionKind, string[]> = {
  deposit: [
    "Wallet reads its public balance for the asset",
    "Wallet requests a ZK proof from the Helius prover",
    "Wallet builds the deposit against the mint's interface PDA",
    "You review and sign in your wallet",
    "The deposit settles in one Solana transaction",
  ],
  transfer: [
    "Wallet fetches and decrypts your encrypted outputs locally",
    "Wallet requests a ZK proof from the Helius prover",
    "Wallet builds the confidential transfer to the recipient",
    "You review and sign in your wallet",
    "The transfer settles in one Solana transaction",
  ],
  withdraw: [
    "Wallet fetches and decrypts your encrypted outputs locally",
    "Wallet requests a ZK proof from the Helius prover",
    "Wallet builds the withdrawal against the mint's interface PDA",
    "You review and sign in your wallet",
    "The withdrawal settles in one Solana transaction",
  ],
};

export function preparePrivacyAction(
  input: PreparePrivacyActionInput,
): PreparedPrivacyAction {
  const owner = requirePublicKey(input.owner, "Owner");
  const mint = requirePublicKey(input.mint, "Mint");
  const asset = privacyAssetForMint(mint);
  const decimals = asset?.decimals ?? 6;
  const amountMinor = parseAmountToMinor(input.amount, decimals);

  let recipient: string | null = null;
  if (input.kind === "transfer") {
    if (!input.recipient) {
      throw new PrivacyPrepareError("Transfers need a recipient");
    }
    recipient = requirePublicKey(input.recipient, "Recipient");
    if (recipient === owner) {
      throw new PrivacyPrepareError(
        "Recipient must differ from the funding wallet",
      );
    }
  }

  const interfacePda = asset?.interfacePda ?? null;
  const needsInterfaceSetup = interfacePda === null;

  return {
    kind: input.kind,
    status: needsInterfaceSetup ? "interface-setup-required" : "prepared",
    owner,
    recipient,
    mint,
    assetSymbol: asset?.symbol ?? null,
    amountMinor: amountMinor.toString(),
    amountDisplay: input.amount.trim(),
    programId: PRIVACY_PROGRAM_ID,
    interfacePda,
    requiresWalletSignature: true,
    serverSigns: false,
    steps: WALLET_STEPS[input.kind],
    note: needsInterfaceSetup
      ? "No interface PDA is published for this mint yet. One can be created permissionlessly before the first confidential deposit; until then this action stays unprepared for signing."
      : "Prepared only. Nothing has been signed or submitted; your wallet completes these steps when you choose to proceed.",
  };
}

/**
 * Prepare the confidential funding of a Lever position: a deposit of the
 * market's collateral asset into the owner's private balance. The position
 * itself is opened separately with public session flow; the funding leg is
 * what stays confidential (asset and amount hidden, sender and recipient
 * public).
 */
export function preparePositionFunding(input: {
  owner: string;
  collateralMint: string;
  amount: string;
}): PreparedPrivacyAction {
  return preparePrivacyAction({
    kind: "deposit",
    owner: input.owner,
    mint: input.collateralMint,
    amount: input.amount,
  });
}

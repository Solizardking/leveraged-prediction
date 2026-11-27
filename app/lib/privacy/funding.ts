// Fail-closed confidential funding verification.
//
// A position may be treated as confidentially funded only when every check
// below passes. Any read failure, missing field, or mismatch returns
// funded: false — an unknown state is never treated as funded, and nothing
// is credited on the strength of a claim alone.

import {
  getShieldedTransactionsBySignature,
  readPrivateBalance,
} from "@/app/lib/privacy/client";
import { requirePrivacyRingsConfig } from "@/app/lib/privacy/config";

export interface FundingAssessment {
  funded: boolean;
  reasons: string[];
}

/**
 * Verify that a specific on-chain transaction actually delivered a
 * shielded output to the expected view tag. This is the ground-truth check
 * for a claimed funding deposit: the transaction is read back from the
 * privacy indexer and must contain an output addressed to the tag.
 */
export async function verifyFundingTransaction(input: {
  signature: string;
  expectedViewTag: string;
}): Promise<FundingAssessment> {
  const reasons: string[] = [];
  try {
    requirePrivacyRingsConfig();
    const result = await getShieldedTransactionsBySignature(input.signature);
    const delivered = result.transactions.some((entry) =>
      entry.transaction.outputSlots.some(
        (output) => output.viewTag === input.expectedViewTag,
      ),
    );
    if (!delivered) {
      reasons.push(
        "The transaction has no shielded output for this view tag",
      );
    }
  } catch (error) {
    reasons.push(
      error instanceof Error
        ? error.message
        : "Funding transaction could not be read",
    );
  }
  return { funded: reasons.length === 0, reasons };
}

/**
 * Assess whether a wallet's private balance can cover a confidential
 * funding amount. The decrypted balance is computed in the user's wallet
 * (the server cannot decrypt); the server independently requires that the
 * encrypted state reads cleanly and is non-empty, and that the
 * wallet-reported balance covers the requirement. A position is funded
 * only when this assessment passes AND the funding transaction verifies
 * via verifyFundingTransaction.
 */
export async function assessConfidentialFunding(input: {
  viewTag: string;
  requiredAmountMinor: bigint;
  walletReportedBalanceMinor: bigint | null;
}): Promise<FundingAssessment> {
  const reasons: string[] = [];
  if (input.walletReportedBalanceMinor === null) {
    reasons.push("Wallet has not reported a decrypted private balance");
  } else if (input.walletReportedBalanceMinor < input.requiredAmountMinor) {
    reasons.push("Decrypted private balance is below the required amount");
  }

  try {
    requirePrivacyRingsConfig();
    const balance = await readPrivateBalance(input.viewTag);
    if (balance.outputCount === 0) {
      reasons.push("No encrypted outputs found for this view tag");
    }
  } catch (error) {
    reasons.push(
      error instanceof Error
        ? error.message
        : "Private balance could not be read",
    );
  }
  return { funded: reasons.length === 0, reasons };
}

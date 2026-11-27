import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  assertViewTag,
  buildEncryptedUtxosRequest,
  decryptPrivateBalance,
  deriveConfidentialViewTag,
  DOCS_EXAMPLE_VIEW_TAGS,
  isDocsExampleViewTag,
  parseEncryptedUtxoPage,
} from "@/app/lib/helius/privacy";

describe("Helius privacy reader", () => {
  it("derives the confidential view tag from the connected wallet, not the docs fixture", () => {
    const wallet = Keypair.generate().publicKey.toBase58();
    expect(deriveConfidentialViewTag(wallet)).toBe(wallet);
    expect(isDocsExampleViewTag(wallet)).toBe(false);
    expect(isDocsExampleViewTag(DOCS_EXAMPLE_VIEW_TAGS.devnet)).toBe(true);
    expect(isDocsExampleViewTag(DOCS_EXAMPLE_VIEW_TAGS.mainnet)).toBe(true);
  });

  it("builds a getEncryptedUtxosByTags request and tracks spendable balances after decrypt", () => {
    const tag = assertViewTag(DOCS_EXAMPLE_VIEW_TAGS.devnet);
    const request = buildEncryptedUtxosRequest({ tags: [tag], limit: 1 });
    expect(request.method).toBe("getEncryptedUtxosByTags");
    expect(request.params.tags).toEqual([tag]);

    const page = parseEncryptedUtxoPage({
      result: {
        data: [{ slot: 1, signature: "sig", outputs: [{ payload: "aaa", viewTag: tag }] }],
        paginationToken: null,
      },
    });
    expect(decryptPrivateBalance({ page }).decrypted).toBe(false);
    const decrypted = decryptPrivateBalance({
      viewingKey: "local-viewing-key",
      page,
      decryptedOutputs: [
        { asset: "USDC", amount: 5n, nullifier: "n1", spent: false },
        { asset: "USDC", amount: 2n, nullifier: "n2", spent: true },
      ],
    });
    expect(decrypted.decrypted).toBe(true);
    expect(decrypted.spendable).toEqual([{ asset: "USDC", amount: "5" }]);
    expect(decrypted.spentNullifiers).toEqual(["n2"]);
  });
});

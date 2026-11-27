import { describe, expect, it } from "vitest";
import {
  parseAmountToMinor,
  preparePrivacyAction,
} from "@/app/lib/privacy/prepare";
import { USDC_ASSET } from "@/app/lib/privacy/constants";

const OWNER = "GjGGg8nkKjJaiRXCcXJuHjcQmFf61vTMPaU7ridhWhLX";
const RECIPIENT = "5Vt1Mnq2b9ynV1EMXS564i5ZDuNudxm8ZG7yCXfH55M";

describe("privacy amount parsing", () => {
  it("parses decimal amounts into minor units without floating point", () => {
    expect(parseAmountToMinor("25", 6)).toBe(25_000_000n);
    expect(parseAmountToMinor("0.5", 9)).toBe(500_000_000n);
    expect(parseAmountToMinor("1.000001", 6)).toBe(1_000_001n);
  });

  it("rejects zero, negative, malformed, and over-precise amounts", () => {
    expect(() => parseAmountToMinor("0", 6)).toThrow();
    expect(() => parseAmountToMinor("-5", 6)).toThrow();
    expect(() => parseAmountToMinor("abc", 6)).toThrow();
    expect(() => parseAmountToMinor("1.0000001", 6)).toThrow();
  });
});

describe("privacy action preparation", () => {
  it("prepares a USDC deposit against the published interface PDA", () => {
    const prepared = preparePrivacyAction({
      kind: "deposit",
      owner: OWNER,
      mint: USDC_ASSET.mint,
      amount: "25",
    });
    expect(prepared.status).toBe("prepared");
    expect(prepared.interfacePda).toBe(USDC_ASSET.interfacePda);
    expect(prepared.amountMinor).toBe("25000000");
    expect(prepared.requiresWalletSignature).toBe(true);
    expect(prepared.serverSigns).toBe(false);
  });

  it("requires a distinct recipient for transfers", () => {
    expect(() =>
      preparePrivacyAction({
        kind: "transfer",
        owner: OWNER,
        mint: USDC_ASSET.mint,
        amount: "5",
      }),
    ).toThrow();
    expect(() =>
      preparePrivacyAction({
        kind: "transfer",
        owner: OWNER,
        recipient: OWNER,
        mint: USDC_ASSET.mint,
        amount: "5",
      }),
    ).toThrow();
    const prepared = preparePrivacyAction({
      kind: "transfer",
      owner: OWNER,
      recipient: RECIPIENT,
      mint: USDC_ASSET.mint,
      amount: "5",
    });
    expect(prepared.recipient).toBe(RECIPIENT);
  });

  it("marks mints without a published interface PDA as setup-required", () => {
    const prepared = preparePrivacyAction({
      kind: "deposit",
      owner: OWNER,
      mint: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
      amount: "10",
    });
    expect(prepared.status).toBe("interface-setup-required");
    expect(prepared.interfacePda).toBeNull();
  });

  it("rejects malformed keys", () => {
    expect(() =>
      preparePrivacyAction({
        kind: "deposit",
        owner: "not-a-key",
        mint: USDC_ASSET.mint,
        amount: "5",
      }),
    ).toThrow();
  });
});

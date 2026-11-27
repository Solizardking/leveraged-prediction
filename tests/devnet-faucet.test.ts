import { describe, expect, it } from "vitest";
import { Keypair } from "@solana/web3.js";
import {
  decodeDevnetFaucetAuthorityBase64,
  isTrustedDevnetRpc,
  requiredTopUp,
  faucetCooldownRemainingMs,
  rememberFaucetFunding,
  resetFaucetCooldownForTests,
  DEVNET_FAUCET_COOLDOWN_MS,
} from "@/app/lib/live/devnet-faucet";

describe("devnet faucet policy", () => {
  it("allows only the explicit trusted Solana devnet RPCs", () => {
    expect(isTrustedDevnetRpc("https://rpc.magicblock.app/devnet")).toBe(true);
    expect(isTrustedDevnetRpc("https://api.devnet.solana.com/")).toBe(true);
    expect(isTrustedDevnetRpc("https://rpc.magicblock.app/mainnet")).toBe(false);
    expect(isTrustedDevnetRpc("https://rpc.magicblock.app/devnet/extra")).toBe(false);
    expect(isTrustedDevnetRpc("https://rpc.magicblock.app.evil.test/devnet")).toBe(false);
    expect(isTrustedDevnetRpc("http://rpc.magicblock.app/devnet")).toBe(false);
  });

  it("tops up only the shortfall across base and ER balances", () => {
    expect(requiredTopUp(100_000_000n, 0n, 0n)).toBe(100_000_000n);
    expect(requiredTopUp(100_000_000n, 25_000_000n, 60_000_000n)).toBe(15_000_000n);
    expect(requiredTopUp(100_000_000n, 0n, 100_000_000n)).toBe(0n);
    expect(requiredTopUp(100_000_000n, 150_000_000n, 25_000_000n)).toBe(0n);
  });

  it("decodes raw and JSON base64 keypair formats for serverless deployments", () => {
    const keypair = Keypair.fromSeed(Uint8Array.from({ length: 32 }, (_, index) => index + 1));
    const rawBase64 = Buffer.from(keypair.secretKey).toString("base64");
    const jsonBase64 = Buffer.from(JSON.stringify(Array.from(keypair.secretKey))).toString("base64");

    expect(decodeDevnetFaucetAuthorityBase64(rawBase64)).toEqual(keypair.secretKey);
    expect(decodeDevnetFaucetAuthorityBase64(jsonBase64)).toEqual(keypair.secretKey);
  });

  it("rejects malformed or incorrectly sized base64 authority values", () => {
    expect(() => decodeDevnetFaucetAuthorityBase64("not base64")).toThrow("not valid base64");
    expect(() => decodeDevnetFaucetAuthorityBase64(Buffer.from("[1,2,3]").toString("base64"))).toThrow(
      "64-byte Solana keypair",
    );
  });
});

describe("devnet faucet cooldown", () => {
  it("enforces a per-wallet cooldown after a funding attempt is recorded", () => {
    resetFaucetCooldownForTests();
    const wallet = "CooldownWallet11111111111111111111111111111";
    const now = 1_000_000;
    expect(faucetCooldownRemainingMs(wallet, now)).toBe(0);
    rememberFaucetFunding(wallet, now);
    expect(faucetCooldownRemainingMs(wallet, now)).toBe(DEVNET_FAUCET_COOLDOWN_MS);
    expect(faucetCooldownRemainingMs(wallet, now + DEVNET_FAUCET_COOLDOWN_MS)).toBe(0);
  });
});

import { PublicKey } from "@solana/web3.js";
import { claimReceiptPda } from "@/app/lib/live/pdas";
import { claimFaucetInstruction } from "@/app/lib/live/instructions";

describe("one-claim receipt wiring", () => {
  const programId = new PublicKey("LnZGGLELewDTyeGU2QiyrB7sZ3VJ4P9QpMQW85NAqhz");

  it("derives one deterministic receipt PDA per wallet", () => {
    const wallet = Keypair.generate().publicKey;
    const other = Keypair.generate().publicKey;
    expect(claimReceiptPda(programId, wallet).toBase58())
      .toBe(claimReceiptPda(programId, wallet).toBase58());
    expect(claimReceiptPda(programId, wallet).toBase58())
      .not.toBe(claimReceiptPda(programId, other).toBase58());
  });

  it("builds the claim instruction with the Anchor discriminator and amount", () => {
    const authority = Keypair.generate().publicKey;
    const wallet = Keypair.generate().publicKey;
    const instruction = claimFaucetInstruction(programId, {
      authority,
      wallet,
      claimReceipt: claimReceiptPda(programId, wallet),
      protocolConfig: Keypair.generate().publicKey,
      collateralMint: Keypair.generate().publicKey,
    }, 100_000_000n);

    expect(Array.from(instruction.data.subarray(0, 8)))
      .toEqual([80, 7, 251, 108, 55, 145, 135, 68]);
    expect(instruction.data.readBigUInt64LE(8)).toBe(100_000_000n);
    expect(instruction.keys[0]).toMatchObject({
      pubkey: authority, isSigner: true, isWritable: true,
    });
    expect(instruction.keys[2]).toMatchObject({
      pubkey: claimReceiptPda(programId, wallet), isWritable: true,
    });
  });
});

// Helius Solana Privacy Rings — public protocol constants.
//
// Source: https://www.helius.dev/docs/privacy/addresses.md
// Mainnet and devnet use the same program addresses. Interface PDAs are
// per-mint and can be created permissionlessly for mints not listed here.

export const PRIVACY_PROGRAM_ID = "ring1GaLCuJnkUMVkX2JeZLTTX17wKsV4fZmPVzXANW";
export const USER_REGISTRY_PROGRAM_ID =
  "regy3WAeRXMYuMYxr5iK3Bf9Arr3PcxGxyzAddbiqDQ";
export const STATE_MERKLE_TREE = "777pvSGe5LaBd9nCczvE2FXEauiwtfGJ5XRpjKyniGor";

export interface PrivacyAsset {
  symbol: string;
  /** SPL mint (the native mint stands in for SOL). */
  mint: string;
  decimals: number;
  /** SPL interface PDA for this mint, when one is published. */
  interfacePda: string | null;
}

export const SOL_ASSET: PrivacyAsset = {
  symbol: "SOL",
  mint: "11111111111111111111111111111111",
  decimals: 9,
  interfacePda: "CiNmas621VuyofiDSrEPfTXHKrdZuB6jMKECyNiMpLXE",
};

export const USDC_ASSET: PrivacyAsset = {
  symbol: "USDC",
  mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  decimals: 6,
  interfacePda: "H4RD4XSWp8TLmrNYCLmV74a5ixude5s9gGqpCFjXkBLQ",
};

export const USDT_ASSET: PrivacyAsset = {
  symbol: "USDT",
  mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  decimals: 6,
  interfacePda: "CXDDALfBKkNurE7sDrqxMWZnbgQphJ96j6tVptKotFb",
};

export const PRIVACY_ASSETS: readonly PrivacyAsset[] = [
  SOL_ASSET,
  USDC_ASSET,
  USDT_ASSET,
];

export function privacyAssetForMint(mint: string): PrivacyAsset | null {
  return PRIVACY_ASSETS.find((asset) => asset.mint === mint) ?? null;
}

export type PrivacyActionKind = "deposit" | "transfer" | "withdraw";

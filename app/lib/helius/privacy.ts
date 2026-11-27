import { PublicKey } from "@solana/web3.js";

export const HELIUS_DEVNET_ENCRYPTED_UTXOS_URL =
  "https://devnet.helius-rpc.com/v1/spr/getEncryptedUtxosByTags";

/** Docs fixture tags only — never use these as the app's default wallet tag. */
export const DOCS_EXAMPLE_VIEW_TAGS = {
  mainnet: "5Vt1Mnq2b9ynV1EMXS564i5ZDuNudxm8ZG7yCXfH55M",
  devnet: "GjGGg8nkKjJaiRXCcXJuHjcQmFf61vTMPaU7ridhWhLX",
} as const;

export function isDocsExampleViewTag(tag: string): boolean {
  return Object.values(DOCS_EXAMPLE_VIEW_TAGS).includes(tag as typeof DOCS_EXAMPLE_VIEW_TAGS.mainnet);
}

/**
 * In confidential (default) rings, the view tag is the wallet's Solana public key.
 * Real tags must be derived from the connected wallet, not from a hardcoded fixture.
 */
export function deriveConfidentialViewTag(walletAddress: string): string {
  return new PublicKey(walletAddress).toBase58();
}

export function assertViewTag(tag: string): string {
  const parsed = new PublicKey(tag).toBase58();
  return parsed;
}

export interface EncryptedUtxoOutput {
  viewTag?: string;
  payload?: string;
  outputContext?: {
    hash?: string;
    treeId?: number;
    leafIndex?: number;
  };
}

export interface EncryptedUtxoTransaction {
  slot?: number;
  signature?: string;
  outputs?: EncryptedUtxoOutput[];
}

export interface EncryptedUtxoPage {
  transactions: EncryptedUtxoTransaction[];
  paginationToken?: string | null;
  contextSlot?: number | null;
}

export function parseEncryptedUtxoPage(payload: unknown): EncryptedUtxoPage {
  const result = payload && typeof payload === "object"
    ? (payload as { result?: { data?: unknown; paginationToken?: unknown; context?: { slot?: unknown } } }).result
    : undefined;
  const data = result?.data ?? (payload as { data?: unknown } | undefined)?.data;
  const rows = Array.isArray(data) ? data : [];
  const transactions = rows.map((row) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    const outputs = Array.isArray(item.outputs) ? item.outputs as EncryptedUtxoOutput[] : [];
    return {
      slot: typeof item.slot === "number" ? item.slot : undefined,
      signature: typeof item.signature === "string" ? item.signature : undefined,
      outputs,
    };
  });
  return {
    transactions,
    paginationToken: typeof result?.paginationToken === "string" ? result.paginationToken : null,
    contextSlot: typeof result?.context?.slot === "number" ? result.context.slot : null,
  };
}

export interface DecryptedOutput {
  asset: string;
  amount: bigint;
  nullifier: string;
  spent: boolean;
}

export interface PrivateBalanceSummary {
  decrypted: boolean;
  reason?: string;
  outputCount: number;
  spendable: { asset: string; amount: string }[];
  spentNullifiers: string[];
}

export function summarizeEncryptedPage(page: EncryptedUtxoPage): { outputCount: number } {
  const outputCount = page.transactions.reduce((sum, tx) => sum + (tx.outputs?.length ?? 0), 0);
  return { outputCount };
}

/**
 * Client-side only. A viewing key never leaves the browser.
 * When decrypted outputs and known spent nullifiers are supplied, spendable
 * balances are the unspent amounts grouped by asset.
 */
export function decryptPrivateBalance(args: {
  viewingKey?: string | Uint8Array | null;
  page: EncryptedUtxoPage;
  decryptedOutputs?: DecryptedOutput[];
}): PrivateBalanceSummary {
  const outputCount = summarizeEncryptedPage(args.page).outputCount;
  if (!args.viewingKey || (typeof args.viewingKey === "string" && args.viewingKey.trim() === "")) {
    return {
      decrypted: false,
      reason: "A wallet viewing key is required to decrypt privately in the browser",
      outputCount,
      spendable: [],
      spentNullifiers: [],
    };
  }
  if (!args.decryptedOutputs) {
    return {
      decrypted: false,
      reason: "Encrypted outputs were fetched; attach a wallet decryptor to open balances and nullifiers",
      outputCount,
      spendable: [],
      spentNullifiers: [],
    };
  }
  const spentNullifiers = args.decryptedOutputs.filter((item) => item.spent).map((item) => item.nullifier);
  const spent = new Set(spentNullifiers);
  const totals = new Map<string, bigint>();
  for (const output of args.decryptedOutputs) {
    if (spent.has(output.nullifier)) continue;
    totals.set(output.asset, (totals.get(output.asset) ?? 0n) + output.amount);
  }
  return {
    decrypted: true,
    outputCount,
    spendable: [...totals.entries()].map(([asset, amount]) => ({ asset, amount: amount.toString() })),
    spentNullifiers,
  };
}

export function buildEncryptedUtxosRequest(params: {
  tags: string[];
  limit?: number;
  paginationToken?: string;
  filters?: { slot?: { gt?: number; gte?: number; lt?: number; lte?: number } };
}): { method: "getEncryptedUtxosByTags"; jsonrpc: "2.0"; id: "1"; params: Record<string, unknown> } {
  const tags = params.tags.map(assertViewTag);
  if (tags.length === 0) throw new Error("At least one view tag is required");
  if (tags.length > 1000) throw new Error("At most 1,000 view tags can be requested");
  return {
    jsonrpc: "2.0",
    id: "1",
    method: "getEncryptedUtxosByTags",
    params: {
      tags,
      ...(params.limit !== undefined ? { limit: params.limit } : {}),
      ...(params.paginationToken ? { paginationToken: params.paginationToken } : {}),
      ...(params.filters ? { filters: params.filters } : {}),
    },
  };
}

export function heliusEncryptedUtxosUrl(apiKey: string): string {
  const url = new URL(HELIUS_DEVNET_ENCRYPTED_UTXOS_URL);
  url.searchParams.set("api-key", apiKey);
  return url.toString();
}

export function readHeliusApiKey(): string {
  const key = process.env.HELIUS_API_KEY?.trim();
  if (!key) throw new Error("HELIUS_API_KEY is not configured on the server");
  return key;
}

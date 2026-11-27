// Server-only client for the Helius Solana Privacy Rings indexer API.
//
// Transport: POST https://<cluster>.helius-rpc.com/v1/spr/{method}?api-key=…
// with a JSON-RPC 2.0 body whose method matches the URL path (see
// https://www.helius.dev/docs/privacy/endpoints.md).
//
// Every failure throws PrivacyReadError. Callers must treat a throw as
// "state unknown" — never as an empty balance and never as funding
// (fail-closed; see funding.ts).

import {
  readPrivacyRingsConfig,
  requirePrivacyRingsConfig,
  type PrivacyRingsConfig,
} from "@/app/lib/privacy/config";
import type {
  EncryptedUtxoPage,
  EncryptedUtxoTransaction,
  HistoryFilters,
  PrivateBalanceRead,
  PrivateHistoryRead,
  ShieldedBySignatureResult,
  ShieldedHistoryPage,
  ShieldedTransactionGroup,
} from "@/app/lib/privacy/types";

export class PrivacyReadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyReadError";
  }
}

const MAX_PAGES = 10;
const DEFAULT_LIMIT = 100;

interface SprErrorBody {
  code: number;
  message: string;
}

async function sprRpc<T>(
  config: PrivacyRingsConfig,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const url = `${config.sprBaseUrl}/${method}?api-key=${encodeURIComponent(config.apiKey)}`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "1", method, params }),
      cache: "no-store",
    });
  } catch (error) {
    throw new PrivacyReadError(
      `Privacy indexer request failed: ${error instanceof Error ? error.message : "network error"}`,
    );
  }
  if (!response.ok) {
    throw new PrivacyReadError(
      `Privacy indexer returned HTTP ${response.status} for ${method}`,
    );
  }
  const body = (await response.json().catch(() => null)) as {
    result?: T;
    error?: SprErrorBody;
  } | null;
  if (!body || body.error || body.result === undefined) {
    const detail = body?.error
      ? `${body.error.code} ${body.error.message}`
      : "malformed response";
    throw new PrivacyReadError(`Privacy indexer error for ${method}: ${detail}`);
  }
  return body.result;
}

export interface TagReadOptions {
  filters?: HistoryFilters;
  limit?: number;
  minContextSlot?: number;
}

/** One page of encrypted UTXOs for the given view tags. */
export async function getEncryptedUtxosByTags(
  tags: string[],
  options: TagReadOptions = {},
  config: PrivacyRingsConfig = readPrivacyRingsConfig(),
): Promise<EncryptedUtxoPage> {
  return sprRpc<EncryptedUtxoPage>(config, "getEncryptedUtxosByTags", {
    tags,
    filters: options.filters,
    limit: options.limit ?? DEFAULT_LIMIT,
    minContextSlot: options.minContextSlot,
  });
}

/** One page of shielded transaction history for the given view tags. */
export async function getShieldedTransactionsByTags(
  tags: string[],
  options: TagReadOptions = {},
  config: PrivacyRingsConfig = readPrivacyRingsConfig(),
): Promise<ShieldedHistoryPage> {
  return sprRpc<ShieldedHistoryPage>(config, "getShieldedTransactionsByTags", {
    tags,
    filters: options.filters,
    limit: options.limit ?? DEFAULT_LIMIT,
    minContextSlot: options.minContextSlot,
  });
}

/** Shielded events for one transaction signature (funding verification). */
export async function getShieldedTransactionsBySignature(
  signature: string,
  config: PrivacyRingsConfig = readPrivacyRingsConfig(),
): Promise<ShieldedBySignatureResult> {
  return sprRpc<ShieldedBySignatureResult>(
    config,
    "getShieldedTransactionsBySignature",
    { txSignature: signature },
  );
}

/**
 * Read a private balance for one view tag.
 *
 * In confidential rings the view tag is the owner's Solana public key. The
 * indexer returns encrypted outputs; summing them into amounts happens in
 * the owner's wallet after decryption with the viewing key. This read
 * therefore returns the encrypted state plus its shape — never amounts.
 *
 * Pagination is followed up to MAX_PAGES; beyond that the read fails
 * closed rather than presenting a partial balance picture.
 */
export async function readPrivateBalance(
  viewTag: string,
): Promise<PrivateBalanceRead> {
  const config = requirePrivacyRingsConfig();
  const transactions: EncryptedUtxoTransaction[] = [];
  let contextSlot = 0;
  let paginationToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result: EncryptedUtxoPage = await sprRpc<EncryptedUtxoPage>(
      config,
      "getEncryptedUtxosByTags",
      {
        tags: [viewTag],
        limit: DEFAULT_LIMIT,
        paginationToken: paginationToken ?? undefined,
      },
    );
    contextSlot = result.context.slot;
    transactions.push(...result.data);
    paginationToken = result.paginationToken;
    if (!paginationToken) {
      const outputCount = transactions.reduce(
        (total, tx) => total + tx.outputs.length,
        0,
      );
      return { viewTag, contextSlot, transactions, outputCount };
    }
  }
  throw new PrivacyReadError(
    "Private balance read exceeded the page bound; refusing a partial read",
  );
}

/** Read recent shielded history for one view tag, newest page first. */
export async function readPrivateHistory(
  viewTag: string,
  limit = 25,
): Promise<PrivateHistoryRead> {
  const config = requirePrivacyRingsConfig();
  const page: ShieldedHistoryPage = await getShieldedTransactionsByTags(
    [viewTag],
    { limit },
    config,
  );
  const entries = page.data.map((group: ShieldedTransactionGroup) => {
    const first = group.events[0];
    return {
      slot: group.slot,
      signature: group.signature,
      outputCount: group.events.reduce((n, e) => n + e.outputSlots.length, 0),
      nullifierCount: group.events.reduce((n, e) => n + e.nullifiers.length, 0),
      messageCount: group.events.reduce((n, e) => n + e.messages.length, 0),
      proofless: group.events.some((e) => e.proofless),
      ringProgramId: first?.ringProgramId ?? null,
    };
  });
  return { viewTag, contextSlot: page.context.slot, entries };
}

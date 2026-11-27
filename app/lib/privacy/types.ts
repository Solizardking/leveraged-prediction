// Types for the Helius Solana Privacy Rings indexer API and the app-level
// shapes built on top of it.
//
// API reference: https://www.helius.dev/docs/api-reference/privacy/llms.txt
// The indexer returns encrypted payloads only. It never decrypts balances or
// history; decryption happens in the user's wallet with their viewing key.

export interface SlotFilter {
  gt?: number;
  gte?: number;
  lt?: number;
  lte?: number;
}

export interface HistoryFilters {
  slot?: SlotFilter;
}

export interface SprContext {
  slot: number;
  blockTime: number;
}

export interface RingsOutputContext {
  /** Commitment hash (base58, 32 bytes). */
  hash: string;
  /** State tree account (deprecated upstream in favour of treeId). */
  tree: string;
  treeId: number;
  leafIndex: number;
}

export interface RingsOutputSlot {
  /** Base58 view tag the output is addressed to. */
  viewTag: string;
  outputContext: RingsOutputContext;
  /** Base64 ciphertext payload. Decryptable only by the view tag's owner. */
  payload: string;
}

export interface RingsMessage {
  viewTag: string;
  /** Base64 payload. */
  payload: string;
}

/** One encrypted UTXO match from getEncryptedUtxosByTags. */
export interface EncryptedUtxoMatch {
  slot: number;
  txSignature: string;
  /** Base64 transaction viewing public key, when present. */
  txViewingPk: string | null;
  /** Base64 transaction-level AES salt shared by every output ciphertext. */
  salt: string | null;
  outputSlot: RingsOutputSlot;
}

export interface EncryptedUtxoTransaction {
  slot: number;
  signature: string;
  outputs: EncryptedUtxoMatch[];
}

export interface EncryptedUtxoPage {
  context: SprContext;
  data: EncryptedUtxoTransaction[];
  paginationToken: string | null;
  outputTreeId?: number;
}

/** One shielded transaction event from getShieldedTransactionsByTags. */
export interface ShieldedTransactionEvent {
  slot: number;
  txSignature: string;
  txViewingPk: string | null;
  salt: string | null;
  outputSlots: RingsOutputSlot[];
  messages: RingsMessage[];
  /** Base58 nullifiers revealed by this transaction (spent outputs). */
  nullifiers: string[];
  proofless: boolean;
  ringConfig?: string;
  ringProgramId?: string;
  eventIndex?: number;
}

export interface ShieldedTransactionGroup {
  slot: number;
  signature: string;
  events: ShieldedTransactionEvent[];
}

export interface ShieldedHistoryPage {
  context: SprContext;
  data: ShieldedTransactionGroup[];
  paginationToken: string | null;
  outputTreeId?: number;
}

/** Result of getShieldedTransactionsBySignature (no pagination). */
export interface ShieldedBySignatureResult {
  context: SprContext;
  transactions: {
    eventIndex: number;
    transaction: ShieldedTransactionEvent;
  }[];
  outputTreeId?: number;
}

/**
 * Result of a private balance read. Amounts are intentionally absent: the
 * indexer returns ciphertext, and only the owner's wallet can decrypt the
 * outputs into per-asset balances (see the read-balance guide, step 4).
 */
export interface PrivateBalanceRead {
  viewTag: string;
  /** Highest slot the indexer had persisted for this read. */
  contextSlot: number;
  /** Encrypted outputs grouped by the transaction that created them. */
  transactions: EncryptedUtxoTransaction[];
  /** Total encrypted outputs across all returned transactions. */
  outputCount: number;
}

export interface PrivateHistoryEntry {
  slot: number;
  signature: string;
  outputCount: number;
  nullifierCount: number;
  messageCount: number;
  proofless: boolean;
  ringProgramId: string | null;
}

export interface PrivateHistoryRead {
  viewTag: string;
  contextSlot: number;
  entries: PrivateHistoryEntry[];
}

/** A prepared (never signed, never submitted) privacy action. */
export interface PreparedPrivacyAction {
  kind: "deposit" | "transfer" | "withdraw";
  status: "prepared" | "interface-setup-required";
  owner: string;
  /** Transfer recipient. Null for deposits and withdrawals. */
  recipient: string | null;
  mint: string;
  assetSymbol: string | null;
  /** Amount in the asset's minor units, as a decimal string. */
  amountMinor: string;
  /** Human-readable amount exactly as entered, e.g. "25.00". */
  amountDisplay: string;
  programId: string;
  /** SPL interface PDA for the mint, when one is published. */
  interfacePda: string | null;
  /** Signing always happens in the user's own wallet. The server never signs. */
  requiresWalletSignature: true;
  serverSigns: false;
  /** Ordered steps the wallet completes to turn this into a transaction. */
  steps: string[];
  note: string;
}

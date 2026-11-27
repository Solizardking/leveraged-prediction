// Server-only Privacy Rings configuration.
//
// The Helius API key stays on the server: browser code talks to the
// /api/privacy routes, never to Helius directly, and no privacy value is
// exposed through NEXT_PUBLIC_*. All Solana reads in this module go through
// the owner's own Helius endpoint — there are no public RPC fallbacks.

export class PrivacyConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PrivacyConfigError";
  }
}

export interface PrivacyRingsConfig {
  cluster: "devnet" | "mainnet";
  /** Solana JSON-RPC base URL on the owner's Helius endpoint (no api-key). */
  rpcBaseUrl: string;
  /** SPR indexer/prover base: `${rpcBaseUrl}/v1/spr`. */
  sprBaseUrl: string;
  apiKey: string;
}

/** Feature flag. Privacy Rings stay inert unless explicitly enabled. */
export function isPrivacyRingsEnabled(): boolean {
  const flag = process.env.PRIVACY_RINGS_ENABLED?.trim().toLowerCase();
  return flag === "1" || flag === "true";
}

function clusterFromEnv(): "devnet" | "mainnet" {
  const cluster = process.env.HELIUS_CLUSTER?.trim().toLowerCase();
  if (cluster === undefined || cluster === "" || cluster === "devnet") {
    return "devnet";
  }
  if (cluster === "mainnet" || cluster === "mainnet-beta") return "mainnet";
  throw new PrivacyConfigError(
    "HELIUS_CLUSTER must be devnet or mainnet when set",
  );
}

/**
 * Resolve the owner's Helius endpoint from the environment.
 *
 * Accepted shapes (same pattern as the owner's other Helius wiring):
 * - HELIUS_RPC_URL: a full endpoint, optionally with ?api-key= embedded.
 * - HELIUS_API_KEY (+ optional HELIUS_CLUSTER): the key on its own; the
 *   endpoint is derived as https://<cluster>.helius-rpc.com.
 *
 * Throws PrivacyConfigError when neither is present. Callers must treat
 * that as fail-closed: no reads, no crediting.
 */
export function readPrivacyRingsConfig(): PrivacyRingsConfig {
  const cluster = clusterFromEnv();
  const envKey = process.env.HELIUS_API_KEY?.trim() || null;
  const envUrl = process.env.HELIUS_RPC_URL?.trim() || null;

  let base: URL;
  let apiKey: string | null = envKey;
  if (envUrl) {
    try {
      base = new URL(envUrl);
    } catch {
      throw new PrivacyConfigError("HELIUS_RPC_URL is not a valid URL");
    }
    if (!apiKey) apiKey = base.searchParams.get("api-key");
    base.search = "";
    base.hash = "";
  } else if (envKey) {
    base = new URL(`https://${cluster}.helius-rpc.com`);
  } else {
    throw new PrivacyConfigError(
      "Privacy Rings need HELIUS_RPC_URL or HELIUS_API_KEY in the server environment",
    );
  }
  if (!apiKey) {
    throw new PrivacyConfigError(
      "Privacy Rings need a Helius API key (HELIUS_API_KEY or ?api-key= in HELIUS_RPC_URL)",
    );
  }

  const rpcBaseUrl = base.toString().replace(/\/$/, "");
  return {
    cluster,
    rpcBaseUrl,
    sprBaseUrl: `${rpcBaseUrl}/v1/spr`,
    apiKey,
  };
}

/** Throws when the feature is disabled or unconfigured. Fail-closed. */
export function requirePrivacyRingsConfig(): PrivacyRingsConfig {
  if (!isPrivacyRingsEnabled()) {
    throw new PrivacyConfigError(
      "Privacy Rings are not enabled on this deployment",
    );
  }
  return readPrivacyRingsConfig();
}

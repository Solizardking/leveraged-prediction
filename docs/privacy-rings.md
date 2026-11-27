# Privacy Rings — confidential collateral

Lever integrates [Helius Solana Privacy Rings](https://www.helius.dev/docs/privacy.md)
so a user can hold a private balance and fund Lever positions
confidentially: the asset and amount stay hidden, sender and recipient stay
public, and every action settles in one Solana transaction. Privacy Rings
are **confidential, never anonymous** — that wording is deliberate in all
product copy.

The integration is **off by default** and stays inert until the owner
enables it (see Flags). Nothing in this module moves funds: reads are
read-only, and fund-moving actions are prepared only — the user's wallet
builds, reviews, and signs in the browser. The server holds no keys and
never signs.

## Pieces

| Path | Role |
| --- | --- |
| `app/lib/privacy/constants.ts` | Program IDs, state tree, per-mint interface PDAs (from the Helius addresses doc). |
| `app/lib/privacy/types.ts` | Indexer API shapes plus app-level read/prepared-action types. |
| `app/lib/privacy/config.ts` | Server-only env resolution and the feature flag. Fail-closed. |
| `app/lib/privacy/client.ts` | SPR indexer client: `getEncryptedUtxosByTags`, `getShieldedTransactionsByTags`, `getShieldedTransactionsBySignature`, plus `readPrivateBalance` / `readPrivateHistory`. |
| `app/lib/privacy/prepare.ts` | Pure preparation layer for deposit / transfer / withdraw and position funding. Validation only — no signing, no submission. |
| `app/lib/privacy/funding.ts` | Fail-closed funding verification (below). |
| `app/api/privacy/balance/route.ts` | `GET ?tag=` — encrypted outputs for a view tag. |
| `app/api/privacy/history/route.ts` | `GET ?tag=&limit=` — public parts of shielded history. |
| `app/api/privacy/prepare/route.ts` | `POST` — prepare an action for the caller's wallet. |
| `app/privacy/page.tsx`, `app/components/privacy-page.tsx` | The `/privacy` panel. |

## How reads work

In confidential rings the view tag is the owner's Solana public key. The
browser never talks to Helius directly: the `/api/privacy` routes call the
SPR indexer (`POST https://<cluster>.helius-rpc.com/v1/spr/{method}`) with
the server-side API key and return the result.

The indexer returns **encrypted outputs only**. Summing outputs into a
balance happens in the owner's wallet after decryption with the viewing
key (read-balance guide, step 4), so the balance API returns ciphertext,
counts, and the indexer context slot — never amounts. History entries
expose only public parts: slot, signature, and output/nullifier counts.

## Fail-closed funding

A position may be treated as confidentially funded only when **both**
checks in `funding.ts` pass:

1. `assessConfidentialFunding` — the encrypted state reads cleanly and is
   non-empty, and the wallet-reported decrypted balance covers the
   required amount.
2. `verifyFundingTransaction` — the claimed funding transaction is read
   back from the indexer and actually contains a shielded output addressed
   to the expected view tag.

Any error, missing field, or mismatch returns `funded: false`. An unknown
state is never treated as funded and nothing is credited on a claim alone.

## Flags and environment

Server (`.env`, never `NEXT_PUBLIC_*`):

```
PRIVACY_RINGS_ENABLED=0        # 1/true turns the API routes on
HELIUS_API_KEY=                # owner's Helius key, server-only
HELIUS_RPC_URL=                # optional full endpoint (may embed ?api-key=)
HELIUS_CLUSTER=devnet          # devnet (default) or mainnet
```

Browser:

```
NEXT_PUBLIC_PRIVACY_RINGS_ENABLED=0   # shows/enables the /privacy panel UI
```

All Solana reads in this module go through the owner's own Helius
endpoint. There are no public RPC fallbacks in these code paths.

## Remaining enablement steps (owner)

1. Set the env vars above on the deployment and flip both flags.
2. Add the SPR wallet SDK (`@heliuslabs/spr`, with `@solana/kit`) and wire
   the prepared actions from `prepare.ts` to on-device proof generation,
   instruction building, and wallet signing. This dependency was
   deliberately not added alongside this module to keep the lockfile
   untouched; decryption of balances into amounts also lands with this
   step, in the wallet only.
3. For the market's collateral mint, confirm an interface PDA exists
   (SOL/USDC/USDT are published); interface PDAs can be created
   permissionlessly for other mints. Preparations for mints without one
   return `interface-setup-required` and cannot be signed.

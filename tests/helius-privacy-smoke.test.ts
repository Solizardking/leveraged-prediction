import { describe, expect, it } from "vitest";
import {
  buildEncryptedUtxosRequest,
  DOCS_EXAMPLE_VIEW_TAGS,
  heliusEncryptedUtxosUrl,
  parseEncryptedUtxoPage,
} from "@/app/lib/helius/privacy";

const enabled = process.env.HELIUS_PRIVACY_SMOKE === "1" && Boolean(process.env.HELIUS_API_KEY);

describe.skipIf(!enabled)("Helius privacy smoke (docs fixture tag only)", () => {
  it("reads the devnet docs example tag through getEncryptedUtxosByTags", async () => {
    const key = process.env.HELIUS_API_KEY!.trim();
    const body = buildEncryptedUtxosRequest({
      tags: [DOCS_EXAMPLE_VIEW_TAGS.devnet],
      limit: 1,
      filters: { slot: { gte: 520119782, lte: 520119782 } },
    });
    const response = await fetch(heliusEncryptedUtxosUrl(key), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
    expect(response.ok).toBe(true);
    const page = parseEncryptedUtxoPage(await response.json());
    expect(Array.isArray(page.transactions)).toBe(true);
  });
});

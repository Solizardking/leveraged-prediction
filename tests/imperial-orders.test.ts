import { describe, expect, it } from "vitest";
import {
  listPythImperialListings,
  parseImperialMarkets,
  isImperialTradingEnabled,
} from "@/app/lib/imperial/markets";
import {
  assertImperialOrderGate,
  buildImperialOrderTicket,
  generateConfirmCode,
  submitImperialOrder,
} from "@/app/lib/imperial/orders";

const base = {
  wallet: "4xMucQ4YA9HFRcJo2rZ2j6CgzCNRfXWJ1uDM3rjVWCT9",
  symbol: "BTC",
  side: "long" as const,
  action: "open" as const,
  sizeUsd: 10,
  collateralUsdc: 2,
  leverage: 5,
  confirm: true,
  confirmCode: "ABC123",
  expectedConfirmCode: "ABC123",
  sessionToken: "session-token-value",
  tradingEnabled: true,
};

describe("Imperial market mapping and order gates", () => {
  it("marks listings tradeable only when Imperial lists the symbol", () => {
    const listings = listPythImperialListings(parseImperialMarkets([
      { symbol: "BTC", marketId: 1, maxLeverage: 200 },
      { symbol: "EURUSD", marketId: 96, maxLeverage: 99 },
    ]));
    expect(listings.find((item) => item.pyth.symbol === "Crypto.BTC/USD")?.listing).toBe("tradeable");
    expect(listings.find((item) => item.pyth.symbol === "FX.USD/CNH")?.listing).toBe("price-only");
    expect(listings.find((item) => item.pyth.symbol === "Equity.US.VOO/USD")?.listing).toBe("price-only");
  });

  it("treats trading as disabled unless the env flag is an explicit 1 or true", () => {
    expect(isImperialTradingEnabled(undefined)).toBe(false);
    expect(isImperialTradingEnabled("0")).toBe(false);
    expect(isImperialTradingEnabled("1")).toBe(true);
    expect(isImperialTradingEnabled("true")).toBe(true);
  });

  it("builds tickets without a builder or platform fee field", () => {
    const ticket = buildImperialOrderTicket(base);
    expect(ticket).not.toHaveProperty("builderCode");
    expect(ticket.sizeUsd).toBe(10_000_000);
    expect(ticket.underwriter).toBe(7);
  });

  it("refuses to submit without the flag, token, confirm box, and confirm code", async () => {
    expect(() => assertImperialOrderGate({ ...base, tradingEnabled: false })).toThrow(/disabled/);
    expect(() => assertImperialOrderGate({ ...base, sessionToken: null })).toThrow(/login token/);
    expect(() => assertImperialOrderGate({ ...base, confirm: false })).toThrow(/Explicit confirmation/);
    expect(() => assertImperialOrderGate({ ...base, confirmCode: "nope" })).toThrow(/confirmation code/);

    const result = await submitImperialOrder({ ...base, tradingEnabled: false });
    expect(result.submitted).toBe(false);
    expect(generateConfirmCode(() => 0)).toHaveLength(6);
  });

  it("only calls the executor after every gate passes", async () => {
    let called = 0;
    const result = await submitImperialOrder(base, async (ticket, token) => {
      called += 1;
      expect(ticket.symbol).toBe("BTC");
      expect(token).toBe("session-token-value");
      return { success: true };
    });
    expect(called).toBe(1);
    expect(result.submitted).toBe(true);
  });
});

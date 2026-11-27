export type ImperialSide = "long" | "short";
export type ImperialAction = "open" | "close";

export interface ImperialOrderInput {
  wallet: string;
  symbol: string;
  side: ImperialSide;
  action: ImperialAction;
  sizeUsd: number;
  collateralUsdc: number;
  leverage: number;
  confirm: boolean;
  confirmCode: string;
  expectedConfirmCode: string;
  sessionToken: string | null;
  tradingEnabled: boolean;
}

export interface ImperialOrderTicket {
  wallet: string;
  symbol: string;
  side: 0 | 1;
  action: 0 | 1;
  orderType: 0;
  triggerCondition: 0;
  sizeUsd: number;
  collateralAmount: number;
  slippageBps: number;
  triggerPrice: 0;
  profileIndex: 0;
  priority: 0;
  underwriter: 7;
  leverage: number;
}

export interface ImperialOrderGateError extends Error {
  code:
    | "TRADING_DISABLED"
    | "MISSING_TOKEN"
    | "CONFIRM_REQUIRED"
    | "CONFIRM_CODE"
    | "INVALID_ORDER";
}

function gateError(code: ImperialOrderGateError["code"], message: string): ImperialOrderGateError {
  const error = new Error(message) as ImperialOrderGateError;
  error.code = code;
  return error;
}

const CONFIRM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateConfirmCode(random = Math.random): string {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += CONFIRM_ALPHABET[Math.floor(random() * CONFIRM_ALPHABET.length)] ?? "A";
  }
  return code;
}

export function confirmCodesMatch(provided: string, expected: string): boolean {
  return provided.trim().toUpperCase() === expected.trim().toUpperCase();
}

export function buildImperialOrderTicket(
  input: Pick<ImperialOrderInput, "wallet" | "symbol" | "side" | "action" | "sizeUsd" | "collateralUsdc" | "leverage">,
): ImperialOrderTicket {
  if (!input.wallet || input.sizeUsd <= 0 || input.collateralUsdc < 0 || input.leverage <= 0) {
    throw gateError("INVALID_ORDER", "Order size, collateral, leverage, and wallet are required");
  }
  return {
    wallet: input.wallet,
    symbol: input.symbol.toUpperCase(),
    side: input.side === "long" ? 0 : 1,
    action: input.action === "open" ? 0 : 1,
    orderType: 0,
    triggerCondition: 0,
    sizeUsd: Math.round(input.sizeUsd * 1_000_000),
    collateralAmount: Math.round(input.collateralUsdc * 1_000_000),
    slippageBps: 50,
    triggerPrice: 0,
    profileIndex: 0,
    priority: 0,
    underwriter: 7,
    leverage: input.leverage,
  };
}

export function assertImperialOrderGate(input: ImperialOrderInput): ImperialOrderTicket {
  if (!input.tradingEnabled) {
    throw gateError(
      "TRADING_DISABLED",
      "Imperial trading is disabled on this deployment (IMPERIAL_TRADING_ENABLED is off)",
    );
  }
  if (!input.sessionToken || input.sessionToken.trim().length < 8) {
    throw gateError("MISSING_TOKEN", "An Imperial login token is required in this browser session");
  }
  if (!input.confirm) {
    throw gateError("CONFIRM_REQUIRED", "Explicit confirmation is required before an Imperial order can be submitted");
  }
  if (!confirmCodesMatch(input.confirmCode, input.expectedConfirmCode)) {
    throw gateError("CONFIRM_CODE", "The confirmation code does not match");
  }
  return buildImperialOrderTicket(input);
}

export interface ImperialSubmitResult {
  submitted: boolean;
  endpoint: "POST /api/v1/mobile/orders";
  ticket: ImperialOrderTicket;
  reason?: string;
  response?: unknown;
}

export async function submitImperialOrder(
  input: ImperialOrderInput,
  execute?: (ticket: ImperialOrderTicket, token: string) => Promise<unknown>,
): Promise<ImperialSubmitResult> {
  try {
    const ticket = assertImperialOrderGate(input);
    if (!execute) {
      return {
        submitted: false,
        endpoint: "POST /api/v1/mobile/orders",
        ticket,
        reason: "No live executor was attached; the ticket was not sent",
      };
    }
    const response = await execute(ticket, input.sessionToken!.trim());
    return {
      submitted: true,
      endpoint: "POST /api/v1/mobile/orders",
      ticket,
      response,
    };
  } catch (error) {
    const ticket = (() => {
      try {
        return buildImperialOrderTicket(input);
      } catch {
        return {
          wallet: input.wallet,
          symbol: input.symbol.toUpperCase(),
          side: 0 as const,
          action: 0 as const,
          orderType: 0 as const,
          triggerCondition: 0 as const,
          sizeUsd: 0,
          collateralAmount: 0,
          slippageBps: 50,
          triggerPrice: 0 as const,
          profileIndex: 0 as const,
          priority: 0 as const,
          underwriter: 7 as const,
          leverage: input.leverage,
        };
      }
    })();
    return {
      submitted: false,
      endpoint: "POST /api/v1/mobile/orders",
      ticket,
      reason: error instanceof Error ? error.message : "Order was not submitted",
    };
  }
}

/** Client-only submitter. The token is attached to this request and is never stored on our server. */
export async function postImperialOrderFromBrowser(
  ticket: ImperialOrderTicket,
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl("https://api.imperial.trade/api/v1/mobile/orders", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(ticket),
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text) as unknown;
  } catch {
    // keep text
  }
  if (!response.ok) {
    throw new Error(`Imperial order rejected (${response.status})`);
  }
  return data;
}

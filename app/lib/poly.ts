import snapshot from "@/app/lib/poly-snapshot.json";

/**
 * Poly — the Clawd fleet's paper-only Polymarket prediction agent.
 *
 * The page renders a committed snapshot of the agent's paper ledger
 * (`agent/poly/state.json`, copied to `poly-snapshot.json`). The live
 * ledger is the scoreboard of record; this snapshot is refreshed by
 * copying the ledger, never by editing numbers here. See POLY.md in
 * `agent/poly/` for the agent's decision law.
 */

export interface PolyCall {
  id: string;
  gammaId: string;
  question: string;
  /** Outcome name the call backs (e.g. a team, or "Yes"). */
  side: string;
  sideIdx: number;
  /** Entry price, 0–1 (the market's probability at call time). */
  entry: number;
  /** Paper USDC staked. */
  stake: number;
  shares: number;
  /** Jev's fair probability for outcome A, in percent (0–100). */
  jevFairA: number;
  /** Jev's edge on the picked side, in probability points. */
  edge: number;
  /** Whether the Jupiter Prediction cross-check price existed. */
  crossChecked: boolean;
  url: string;
  closeTime: string | null;
  /** ISO timestamp the call was written to the ledger. */
  at: string;
  note: string;
}

export interface PolySettledCall extends PolyCall {
  won: boolean;
  /** Paper P&L in USDC, signed. */
  pnl: number;
  settledAt: string;
}

export interface PolySnapshot {
  /** Paper bankroll in USDC (cash; open stakes are already deducted). */
  bankroll: number;
  calls: PolyCall[];
  settled: PolySettledCall[];
  fail_streak: number;
  /** Date the snapshot was copied from the ledger (yyyy-mm-dd). */
  capturedAt: string;
  source: string;
}

export const polySnapshot = snapshot as PolySnapshot;

/** The edge gate: a paper call needs at least this many points of edge. */
export const POLY_EDGE_MIN_POINTS = 8;
/** Paper bankroll the ledger started with. */
export const POLY_BANKROLL_START = 10000;

export function polyStats(snap: PolySnapshot) {
  const wins = snap.settled.filter((entry) => entry.won).length;
  const settledPnl = snap.settled.reduce((sum, entry) => sum + entry.pnl, 0);
  const openStake = snap.calls.reduce((sum, call) => sum + call.stake, 0);
  return {
    openCalls: snap.calls.length,
    settledCalls: snap.settled.length,
    wins,
    losses: snap.settled.length - wins,
    settledPnl,
    openStake,
  };
}

export function formatPolyUsdc(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  const sign = value < 0 ? "−" : "";
  const absolute = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${sign}$${absolute}`;
}

export function formatPolySignedUsdc(value: number): string {
  if (value > 0) {
    return `+${formatPolyUsdc(value)}`;
  }
  return formatPolyUsdc(value);
}

/** Prices are probabilities: render 0.205 as "20.5%". */
export function formatPolyPrice(price: number): string {
  return `${(price * 100).toFixed(1)}%`;
}

export function formatPolyPercentPoints(value: number): string {
  return `${value.toFixed(1)} pts`;
}

export function formatPolyDate(iso: string | null | undefined): string {
  if (!iso) {
    return "—";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

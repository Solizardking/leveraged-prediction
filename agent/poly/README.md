# Poly — Polymarket prediction agent (paper only)

Poly is the Clawd fleet's Polymarket prediction agent, vendored into this
repo. Its operating law is **POLY.md** in this directory — read it first.

**Paper only.** Poly has no wallet, reads no keys, and has no order path.
Every call is simulated against live Polymarket prices and written to a
paper ledger. Nothing in this directory can place, modify, or cancel a
real order, on any venue.

## How it decides

1. **Scan** — pull active Polymarket events from the Gamma API (keyless),
   highest 24h volume first.
2. **Price** — read the market's outcome prices as the crowd's probability.
3. **Cross-check** — where the Jupiter Prediction API carries the same
   market (`POLY-<id>`), compare its mid price. A disagreement over 5¢
   vetoes the call.
4. **Judge** — Jev (TypeSafe System One) returns a typed fair probability
   and a value pick (A / B / pass), never told to agree with the market.
5. **Decide** — a paper call fires only when Jev's edge on the picked side
   is **≥ 8 probability points**, the pick agrees, the market has ≥ $5,000
   volume, and the market is not already in the ledger. One call per
   market, ever.
6. **Settle** — later runs settle open calls against Gamma's resolved
   prices and book the paper P&L. Settled calls are immutable.

Paper sizing (bankroll starts at 10,000 paper USDC, fixed tiers, no
compounding discretion):

| Edge | Stake (paper USDC) |
| --- | --- |
| ≥ 15 points | 250 |
| ≥ 10 points | 150 |
| ≥ 8 points | 100 |

Fail-closed: any layer failing (Gamma down, Jev erroring, ledger
unreadable) means no new calls that run; the failure streak increments
and an alert turns on at 3 consecutive failures.

## Run

Poly runs in the Clawd fleet environment — `poly.py` is stdlib-only but
shells out to the fleet's Jev CLI and Jupiter Prediction CLI at their
fleet paths, so it is not expected to run standalone from a fresh clone.

```bash
python3 poly.py            # one scan / judge / call cycle
python3 poly.py --dry-run  # judge but write nothing
python3 poly.py --limit 6  # cap Jev judgments per run
```

Each run prints exactly one JSON line: `called`, `settled`, `watching`,
`bankroll`, `alert`, `error`.

## Files

| File | Role |
| --- | --- |
| `POLY.md` | The manifest — identity, decision law, rails, verdict law |
| `poly.py` | The agent (Python, stdlib only) |
| `state.json` | The paper ledger: `bankroll`, open `calls[]`, `settled[]`, `fail_streak`. Written atomically (tmp + replace). The scoreboard of record. |

## Frontend

The Lever app in this repo renders Poly's record at `/poly`, from a
committed snapshot of this ledger (`app/lib/poly-snapshot.json`). The
snapshot is refreshed by copying `state.json` — the page never invents
calls or results, and shows an honest empty state until the gate fires.

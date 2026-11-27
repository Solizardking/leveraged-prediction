#!/usr/bin/env python3
"""Poly — Clawd's paper Polymarket prediction agent.

Manifest: POLY.md (same directory). Scan Polymarket Gamma, cross-check
YES prices against the Jupiter Prediction API's polymarket provider,
ask Jev (TypeSafe System One) for a typed fair-probability judgment,
and paper-call only the markets where Jev's fair price beats the
market's by >= 8 points with the pick agreeing. One call per market,
ever; calls settle against Gamma's resolved prices on later runs.

Paper only: no wallet, no keys, no order path exists in this file.

Prints exactly one JSON line:
  {"called": [...], "settled": [...], "watching": int,
   "bankroll": float, "alert": bool, "error": str | null}

Usage: python3 poly.py [--dry-run] [--limit 12]
State: ~/workspace/clawd-poly-bot/state.json (atomic write).
"""
import json
import os
import subprocess
import sys
import urllib.request
from datetime import datetime, timezone

GAMMA = "https://gamma-api.polymarket.com"
HERE = os.path.dirname(os.path.abspath(__file__))
STATE_FILE = os.path.join(HERE, "state.json")
JEV_CLI = os.path.expanduser(
    "~/workspace/custom-skills/local-typesafe-ai/bin/jev.py")
JUP_CLI = os.path.expanduser(
    "~/workspace/custom-connectors/custom.legacy-jupiter/bin/jup_predict.py")

BANKROLL_START = 10000.0
MIN_VOL = 5000.0
EDGE_MIN = 8.0          # probability points
XCHECK_TOL = 0.05       # 5 cents
STAKES = [(15.0, 250.0), (10.0, 150.0), (8.0, 100.0)]


def get_json(url, timeout=35):
    req = urllib.request.Request(url, headers={"user-agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode())


def gamma_events(tag=None, limit=40):
    q = (f"{GAMMA}/events?active=true&closed=false&order=volume24hr"
         f"&ascending=false&limit={limit}")
    if tag:
        q += f"&tag_slug={tag}"
    try:
        return get_json(q) or []
    except Exception as e:
        print(f"gamma pull failed ({tag}): {type(e).__name__}", file=sys.stderr)
        return []


def jupiter_yes_map():
    """marketId (POLY-<id>) -> Jupiter mid YES price, trending feed."""
    out = {}
    try:
        p = subprocess.run(
            [sys.executable, JUP_CLI, "events", "--provider", "polymarket",
             "--filter", "trending", "--include-markets"],
            capture_output=True, text=True, timeout=60)
        data = json.loads(p.stdout)
        for ev in data.get("events", []):
            for m in ev.get("markets", []):
                try:
                    buy = float(str(m.get("buyYesUsd", "")).replace("$", ""))
                    sell = float(str(m.get("sellYesUsd", "")).replace("$", ""))
                    if 0 < buy < 1 and 0 < sell < 1:
                        out[m["marketId"]] = round((buy + sell) / 2, 4)
                except (TypeError, ValueError):
                    continue
    except Exception as e:
        print(f"jupiter cross-check failed: {type(e).__name__}",
              file=sys.stderr)
    return out


BANDS = ["0-10% — nearly impossible", "10-20% — very unlikely",
         "20-30% — unlikely", "30-40% — leaning no", "40-50% — just under even",
         "50-60% — just over even", "60-70% — leaning yes", "70-80% — likely",
         "80-90% — very likely", "90-100% — nearly certain"]


def jev_judge(state_text, name_a, name_b):
    """One Jev judgment -> (fairAPct, pick in {a, b, pass}).

    fairA is a Jev Score across ten probability bands (a probability-
    weighted position on ordered levels, 0..9) for outcome A; the fair
    probability is the band-midpoint mapping (score + 0.5) * 10,
    clamped to 1..99. Outcome A/B are the market's own outcome names
    ("Yes"/"No" on binary markets, team names on game markets).
    """
    questions = {
        "fairA": {
            "type": "score",
            "instructions": (f"Estimate the true probability that outcome "
                             f"A ({name_a}) wins this prediction market, "
                             f"as a position across the probability bands. "
                             f"Judge the event itself, not the market price."),
            "criteria": BANDS,
        },
        "pick": {
            "type": "choice",
            "instructions": ("Which outcome, if any, is underpriced at "
                             "the stated market prices?"),
            "criteria": {
                "a": f"{name_a} is underpriced relative to its true probability",
                "b": f"{name_b} is underpriced relative to its true probability",
                "pass": "Neither outcome has a meaningful edge",
            },
        },
    }
    p = subprocess.run(
        [sys.executable, JEV_CLI, "ask", "--state", state_text,
         "--questions", json.dumps(questions)],
        capture_output=True, text=True, timeout=120)
    if p.returncode != 0:
        raise RuntimeError(f"jev failed rc={p.returncode}: {p.stderr[:200]}")
    answers = json.loads(p.stdout)
    raw = answers.get("fairA", {}).get("score")
    pick = answers.get("pick", {}).get("choice")
    if raw is None or pick not in ("a", "b", "pass"):
        raise RuntimeError(f"jev malformed answer: {str(answers)[:200]}")
    fair = min(99.0, max(1.0, (float(raw) + 0.5) * 10))
    return fair, pick


def load_state():
    try:
        with open(STATE_FILE) as f:
            return json.load(f)
    except Exception:
        return {"bankroll": BANKROLL_START, "calls": [], "settled": [],
                "fail_streak": 0}


def save_state(state):
    tmp = STATE_FILE + ".tmp"
    with open(tmp, "w") as f:
        json.dump(state, f, indent=1)
    os.replace(tmp, STATE_FILE)


def stake_for(edge):
    for floor, stake in STAKES:
        if edge >= floor:
            return stake
    return 0.0


def num(x):
    try:
        return float(x)
    except (TypeError, ValueError):
        return 0.0


def main():
    dry = "--dry-run" in sys.argv
    limit = 12
    if "--limit" in sys.argv:
        limit = int(sys.argv[sys.argv.index("--limit") + 1])
    state = load_state()
    result = {"called": [], "settled": [], "watching": 0,
              "bankroll": state["bankroll"], "alert": False, "error": None}
    try:
        # --- settle open calls against Gamma resolution ---
        still_open = []
        for call in state["calls"]:
            if call.get("settled"):
                continue
            try:
                m = get_json(f"{GAMMA}/markets/{call['gammaId']}")
            except Exception:
                still_open.append(call)
                continue
            prices = m.get("outcomePrices")
            try:
                prices = json.loads(prices) if isinstance(prices, str) else prices
                side_p = float(prices[call["sideIdx"]])
            except Exception:
                still_open.append(call)
                continue
            if m.get("closed") and side_p in (0.0, 1.0):
                won = side_p == 1.0
                payout = call["shares"] * (1.0 if won else 0.0)
                pnl = round(payout - call["stake"], 2)
                state["bankroll"] = round(state["bankroll"] + payout, 2)
                entry = {**call, "settled": True, "won": won, "pnl": pnl,
                         "settledAt": datetime.now(timezone.utc).isoformat()}
                state["settled"].append(entry)
                result["settled"].append(
                    {"id": call["id"], "won": won, "pnl": pnl})
            else:
                still_open.append(call)
        state["calls"] = still_open + [c for c in state["calls"]
                                       if c.get("settled")]

        # --- scan candidates ---
        events, seen = [], set()
        for tag, lim in (("sports", 40), (None, 25)):
            for ev in gamma_events(tag, lim):
                if ev.get("id") not in seen:
                    seen.add(ev.get("id"))
                    events.append(ev)
        known = {c["id"] for c in state["calls"]} | \
                {c["id"] for c in state["settled"]}
        cands = []
        for ev in events:
            slug = ev.get("slug") or ""
            for m in ev.get("markets") or []:
                q = (m.get("question") or "").strip()
                if not q or m.get("closed"):
                    continue
                try:
                    prices = json.loads(m.get("outcomePrices"))
                    pa, pb = float(prices[0]), float(prices[1])
                    outs = m.get("outcomes")
                    outs = json.loads(outs) if isinstance(outs, str) else outs
                    name_a, name_b = str(outs[0]), str(outs[1])
                except Exception:
                    continue
                vol = num(m.get("volumeNum"))
                if vol < MIN_VOL or not (0.005 < pa < 0.995):
                    continue
                mid = f"POLY-{m.get('id')}"
                if mid in known:
                    continue
                cands.append({"id": mid, "gammaId": str(m.get("id")),
                              "question": q, "pa": pa, "pb": pb,
                              "nameA": name_a, "nameB": name_b,
                              "volumeUsd": vol,
                              "closeTime": m.get("endDate"),
                              "url": f"https://polymarket.com/event/{slug}"})
        cands.sort(key=lambda x: -x["volumeUsd"])
        cands = cands[:limit]
        result["watching"] = len(cands)
        jmap = jupiter_yes_map()

        # --- judge + decide ---
        for c in cands:
            jup = jmap.get(c["id"])
            cross_ok = (jup is None) or abs(jup - c["pa"]) <= XCHECK_TOL
            state_text = (
                f"Polymarket market: {c['question']} "
                f"Outcomes: A = {c['nameA']} priced {c['pa']*100:.1f} cents, "
                f"B = {c['nameB']} priced {c['pb']*100:.1f} cents. "
                f"24h volume ${c['volumeUsd']:,.0f}. "
                f"Closes: {c['closeTime']}.")
            if jup is not None:
                state_text += (f" Independent cross-check price for "
                               f"{c['nameA']}: {jup*100:.1f} cents.")
            fair, pick = jev_judge(state_text, c["nameA"], c["nameB"])
            if pick == "pass" or not cross_ok:
                continue
            if pick == "a":
                edge = fair - c["pa"] * 100
                price, side_idx, side = c["pa"], 0, c["nameA"]
            else:
                edge = (100 - fair) - c["pb"] * 100
                price, side_idx, side = c["pb"], 1, c["nameB"]
            stake = stake_for(edge)
            if edge < EDGE_MIN or stake == 0 or price <= 0:
                continue
            if stake > state["bankroll"]:
                continue
            call = {"id": c["id"], "gammaId": c["gammaId"],
                    "question": c["question"], "side": side,
                    "sideIdx": side_idx,
                    "entry": price, "stake": stake,
                    "shares": round(stake / price, 4),
                    "jevFairA": fair, "edge": round(edge, 2),
                    "crossChecked": jup is not None,
                    "url": c["url"], "closeTime": c["closeTime"],
                    "at": datetime.now(timezone.utc).isoformat(),
                    "settled": False,
                    "note": (f"Poly paper call: Jev fair {c['nameA']} "
                             f"{fair:.0f}% vs market {c['pa']*100:.1f}c — "
                             f"{side} edge {edge:.1f} pts, stake "
                             f"{stake:.0f} paper USDC.")}
            state["bankroll"] = round(state["bankroll"] - stake, 2)
            state["calls"].append(call)
            result["called"].append(call)
        state["fail_streak"] = 0
        result["bankroll"] = state["bankroll"]
    except Exception as exc:  # noqa: BLE001
        state["fail_streak"] = int(state.get("fail_streak") or 0) + 1
        result["error"] = f"{type(exc).__name__}: {exc}"
        result["alert"] = state["fail_streak"] >= 3
    if not dry:
        save_state(state)
    else:
        result["dryRun"] = True
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    sys.exit(main())

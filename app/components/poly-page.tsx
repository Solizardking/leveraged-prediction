import { BrandMark } from "@/app/components/brand-mark";
import { RouteNav } from "@/app/components/route-nav";
import {
  formatPolyDate,
  formatPolyPercentPoints,
  formatPolyPrice,
  formatPolySignedUsdc,
  formatPolyUsdc,
  POLY_BANKROLL_START,
  POLY_EDGE_MIN_POINTS,
  polySnapshot,
  polyStats,
} from "@/app/lib/poly";

const MANIFEST_URL =
  "https://github.com/Solizardking/leveraged-prediction/blob/main/agent/poly/POLY.md";

export function PolyPage() {
  const snap = polySnapshot;
  const stats = polyStats(snap);

  return (
    <main className="app-shell poly-shell">
      <header className="topbar">
        <div className="brand-area">
          <BrandMark />
          <RouteNav active="poly" />
        </div>
        <div className="topbar-actions">
          <span className="paper-badge">Paper only · no live trading</span>
        </div>
      </header>

      <div className="poly-layout">
        <section className="leaderboard-hero">
          <div className="leaderboard-intro">
            <span className="eyebrow">Polymarket · prediction agent</span>
            <h1>Poly</h1>
            <p>
              Poly scans Polymarket, prices each market twice — the crowd&apos;s
              price, and Jev&apos;s independent fair probability — and paper-calls
              only the gaps that survive both checks. Every call is written
              to its ledger before the event and settled against the
              resolved price after it.
            </p>
          </div>
          <div className="total-volume-card">
            <span>Paper bankroll</span>
            <strong className="num">{formatPolyUsdc(snap.bankroll)}</strong>
            <small>
              Paper USDC · started at {formatPolyUsdc(POLY_BANKROLL_START)} ·
              no real funds
            </small>
          </div>
        </section>

        <p className="paper-notice" role="note">
          <strong>Paper only.</strong> Poly has no wallet and no order path.
          Every call on this page is simulated against live prices — it is a
          record, not advice, and nothing here places a real trade.
        </p>

        <section className="your-ranking" aria-labelledby="poly-record-title">
          <div className="leaderboard-section-heading">
            <div>
              <h2 id="poly-record-title">The record</h2>
              <p>
                Settled P&amp;L is the scoreboard. Open calls are shown at
                entry, never as results.
              </p>
            </div>
            <span className="leaderboard-period">
              Snapshot {snap.capturedAt}
            </span>
          </div>
          <dl className="your-ranking-metrics">
            <div>
              <dt>Open calls</dt>
              <dd className="num">{stats.openCalls}</dd>
            </div>
            <div>
              <dt>Settled calls</dt>
              <dd className="num">{stats.settledCalls}</dd>
            </div>
            <div>
              <dt>Wins – losses</dt>
              <dd className="num">
                {stats.wins} – {stats.losses}
              </dd>
            </div>
            <div>
              <dt>Settled P&amp;L</dt>
              <dd
                className={`num ${stats.settledPnl > 0 ? "pnl-up" : stats.settledPnl < 0 ? "pnl-down" : ""}`}
              >
                {stats.settledCalls > 0
                  ? formatPolySignedUsdc(stats.settledPnl)
                  : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="leaderboard-card" aria-labelledby="poly-open-title">
          <div className="leaderboard-section-heading">
            <div>
              <h2 id="poly-open-title">Open paper calls</h2>
              <p>Written to the ledger at the live price, exactly once per market.</p>
            </div>
            <span className="leaderboard-period">
              {formatPolyUsdc(stats.openStake)} staked
            </span>
          </div>
          {snap.calls.length > 0 ? (
            <div className="leaderboard-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Market</th>
                    <th scope="col">Side</th>
                    <th scope="col">Entry</th>
                    <th scope="col">Edge</th>
                    <th scope="col">Stake</th>
                    <th scope="col">Called</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.calls.map((call) => (
                    <tr key={call.id}>
                      <td>
                        <a
                          className="poly-market-link"
                          href={call.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {call.question}
                        </a>
                      </td>
                      <td>
                        <span className="leaderboard-trader">{call.side}</span>
                      </td>
                      <td className="num">{formatPolyPrice(call.entry)}</td>
                      <td className="num">
                        {formatPolyPercentPoints(call.edge)}
                      </td>
                      <td className="num">{formatPolyUsdc(call.stake)}</td>
                      <td className="num">{formatPolyDate(call.at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="leaderboard-empty-state">
              <strong>No open paper calls</strong>
              <span>
                Poly has not called a market yet. A call fires only when the
                edge gate below clears — an efficient board produces no
                calls, by design.
              </span>
            </div>
          )}
        </section>

        <section className="leaderboard-card" aria-labelledby="poly-settled-title">
          <div className="leaderboard-section-heading">
            <div>
              <h2 id="poly-settled-title">Settled calls</h2>
              <p>Settled against the resolved price. Settled calls never change.</p>
            </div>
            <span className="leaderboard-period">All time</span>
          </div>
          {snap.settled.length > 0 ? (
            <div className="leaderboard-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Market</th>
                    <th scope="col">Side</th>
                    <th scope="col">Entry</th>
                    <th scope="col">Result</th>
                    <th scope="col">P&amp;L</th>
                    <th scope="col">Settled</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.settled.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <a
                          className="poly-market-link"
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {entry.question}
                        </a>
                      </td>
                      <td>
                        <span className="leaderboard-trader">{entry.side}</span>
                      </td>
                      <td className="num">{formatPolyPrice(entry.entry)}</td>
                      <td>
                        <span className={entry.won ? "pnl-up" : "pnl-down"}>
                          {entry.won ? "Won" : "Lost"}
                        </span>
                      </td>
                      <td
                        className={`num ${entry.pnl > 0 ? "pnl-up" : entry.pnl < 0 ? "pnl-down" : ""}`}
                      >
                        {formatPolySignedUsdc(entry.pnl)}
                      </td>
                      <td className="num">{formatPolyDate(entry.settledAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="leaderboard-empty-state">
              <strong>No settled calls yet</strong>
              <span>
                Settlements appear here after a called market resolves on
                Polymarket.
              </span>
            </div>
          )}
        </section>

        <section className="your-ranking" aria-labelledby="poly-gate-title">
          <div className="leaderboard-section-heading">
            <div>
              <h2 id="poly-gate-title">The {POLY_EDGE_MIN_POINTS}-point edge gate</h2>
              <p>
                The rule is mechanical. No discretion, no override — a call
                fires only when every condition holds.
              </p>
            </div>
          </div>
          <ol className="poly-gate-steps">
            <li>
              <strong>Scan and price.</strong> Poly pulls active Polymarket
              events from Gamma, highest 24h volume first, and reads the
              market price as the crowd&apos;s probability. The market must be
              active and unresolved, with at least $5,000 of volume.
            </li>
            <li>
              <strong>Cross-check.</strong> Where the Jupiter Prediction API
              carries the same market, its price must agree with Gamma
              within 5¢. A bigger disagreement means the quote itself is
              suspect — no call on a suspect quote.
            </li>
            <li>
              <strong>Judge.</strong> Jev returns an independent fair
              probability and a value pick. Jev is never told to agree with
              the market, and a &quot;pass&quot; pick ends the evaluation.
            </li>
            <li>
              <strong>Decide.</strong> Jev&apos;s fair probability must beat the
              market price on the picked side by at least{" "}
              {POLY_EDGE_MIN_POINTS} points. Stakes are fixed tiers: 100
              paper USDC at 8 points, 150 at 10, 250 at 15. One call per
              market, ever.
            </li>
            <li>
              <strong>Settle.</strong> On later runs, open calls settle
              against Gamma&apos;s resolved prices: a winning side pays 1.00, a
              loser 0. When Jev and the market disagree and the market wins,
              the ledger says so.
            </li>
          </ol>
          <p className="poly-manifest-note">
            Full operating law:{" "}
            <a href={MANIFEST_URL} target="_blank" rel="noreferrer">
              POLY.md
            </a>{" "}
            in this repo. This page renders a committed snapshot of the
            agent&apos;s ledger ({snap.source}); the live ledger is the
            scoreboard of record.
          </p>
        </section>
      </div>
    </main>
  );
}

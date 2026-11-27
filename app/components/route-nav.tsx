import Link from "next/link";

type PrimaryRoute = "trade" | "liquidity" | "leaderboard" | "privacy" | "oracle";

export function RouteNav({ active }: { active: PrimaryRoute }) {
  return (
    <nav className="route-nav" aria-label="Primary">
      <Link href="/" aria-current={active === "trade" ? "page" : undefined}>
        Trade
      </Link>
      <Link
        href="/liquidity"
        aria-current={active === "liquidity" ? "page" : undefined}
      >
        <span className="route-label-full">Liquidity</span>
        <span className="route-label-short" aria-hidden="true">Pool</span>
      </Link>
      <Link
        href="/leaderboard"
        aria-current={active === "leaderboard" ? "page" : undefined}
      >
        <span className="route-label-full">Leaderboard</span>
        <span className="route-label-short" aria-hidden="true">Leaders</span>
      </Link>
      <Link
        href="/privacy"
        aria-current={active === "privacy" ? "page" : undefined}
      >
        Privacy
      </Link>
      <Link
        href="/oracle"
        aria-current={active === "oracle" ? "page" : undefined}
      >
        <span className="route-label-full">Oracle markets</span>
        <span className="route-label-short" aria-hidden="true">Oracle</span>
      </Link>
    </nav>
  );
}

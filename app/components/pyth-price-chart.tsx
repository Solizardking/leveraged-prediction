"use client";

import type { PythHistoryBar } from "@/app/lib/pyth/server";

export function PythPriceChart({
  bars,
  lastPrice,
  label,
}: {
  bars: PythHistoryBar[];
  lastPrice: number | null;
  label: string;
}) {
  const values = bars.map((bar) => bar.close);
  if (lastPrice !== null) values.push(lastPrice);
  const width = 640;
  const height = 220;
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 0 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / span) * height;
    return `${x},${y}`;
  }).join(" ");

  return (
    <section className="pyth-chart" aria-label={`${label} price chart`}>
      {points ? (
        <svg viewBox={`0 0 ${width} ${height}`} role="img">
          <polyline fill="none" stroke="currentColor" strokeWidth="3" points={points} />
        </svg>
      ) : (
        <p>No history yet.</p>
      )}
    </section>
  );
}

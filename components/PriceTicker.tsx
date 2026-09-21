"use client";

import type { TickerItem } from "../lib/model";

function fmtUsd(n: number): string {
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.000001) return `$${n.toFixed(6)}`;
  return "<$0.000001";
}

export function PriceTicker({ items }: { items: TickerItem[] }) {
  if (!items || items.length === 0) return null;
  // duplicate the list so the marquee loops seamlessly
  const loop = [...items, ...items];
  return (
    <div className="ticker" aria-label="Token prices">
      <div className="ticker-track">
        {loop.map((it, i) => (
          <span className="tick" key={i}>
            <b>{it.sym}</b>
            <span className="tprice">{fmtUsd(it.price)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

"use client";

import type { TickerItem } from "../lib/model";

function fmtUsd(n: number): string {
  if (n >= 1) return `$${n.toFixed(n >= 100 ? 2 : 3)}`;
  return `$${n.toFixed(6)}`;
}
function fmtQuote(n: number): string {
  if (n >= 1) return n.toFixed(4);
  return n.toPrecision(4);
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
            <span className="tprice">
              {it.usd ? fmtUsd(it.price) : `${fmtQuote(it.price)} ${it.quote}`}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

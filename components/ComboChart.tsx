"use client";

import { useState } from "react";
import { usd } from "../lib/format";

export interface ComboPoint {
  label: string; // x label (time)
  volume: number;
  fees: number;
  meta?: string; // extra tooltip line, e.g. "7 pools"
}

export function ComboChart({ points, height = 200 }: { points: ComboPoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) {
    return <div className="chart-empty" style={{ height }}>Data appears here as 5-minute windows accrue.</div>;
  }
  const volMax = Math.max(1, ...points.map((p) => p.volume));
  const feeMax = Math.max(1e-9, ...points.map((p) => p.fees));
  const active = hover ?? points.length - 1;
  const p = points[active]!;

  const linePts = points
    .map((pt, i) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 50;
      const y = 100 - (pt.fees / feeMax) * 100;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="combo">
      <div className="combo-yl">
        <span>{usd(volMax)}</span>
        <span>{usd(volMax / 2)}</span>
        <span>$0</span>
      </div>
      <div className="combo-plot" style={{ height }} onMouseLeave={() => setHover(null)}>
        <div className="combo-grid"><i /><i /><i /></div>
        <div className="combo-bars">
          {points.map((pt, i) => (
            <div
              key={i}
              className={`cbar ${i === points.length - 1 ? "now" : ""} ${i === active ? "sel" : ""}`}
              style={{ height: `${Math.max(2, (pt.volume / volMax) * 100)}%` }}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </div>
        <svg className="combo-line" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <polyline points={linePts} fill="none" stroke="var(--gold)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="combo-tip" style={{ left: `${((active + 0.5) / points.length) * 100}%` }}>
          <div className="ct-t">{p.label}</div>
          <div className="ct-r"><span className="d vol" />Vol<b>{usd(p.volume)}</b></div>
          <div className="ct-r"><span className="d fee" />Fees<b>{usd(p.fees)}</b></div>
          {p.meta && <div className="ct-m">{p.meta}</div>}
        </div>
      </div>
      <div className="combo-yr">
        <span>{usd(feeMax)}</span>
        <span>{usd(feeMax / 2)}</span>
        <span>$0</span>
      </div>
      <div className="combo-x">
        <span>{points[0]!.label}</span>
        <span>{points[Math.floor(points.length / 2)]!.label}</span>
        <span>now</span>
      </div>
      <div className="combo-legend">
        <span><i className="lg vol" />Volume</span>
        <span><i className="lg fee" />Fees</span>
      </div>
    </div>
  );
}

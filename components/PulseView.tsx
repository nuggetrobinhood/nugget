"use client";

import { useState } from "react";
import Link from "next/link";
import type { PulseData, Window } from "../lib/model";
import { WINDOWS } from "../lib/model";
import { usd, signedUsd, feeTierPct, apr, multiple, hhmm, RISK_LABELS } from "../lib/format";
import { VelocityBadge } from "./Velocity";

function WindowFilter({ active }: { active: Window }) {
  return (
    <div className="filter">
      {WINDOWS.map((w) => (
        <Link key={w} href={`/?w=${w}`} className={w === active ? "on" : ""}>
          {w}
        </Link>
      ))}
    </div>
  );
}

function Chart({ points }: { points: PulseData["chart"] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => p.volumeUsd));
  const active = hover ?? points.length - 1;
  const p = points[active]!;
  return (
    <div className="chart-wrap">
      <div className="chart">
        {points.map((pt, i) => (
          <div
            key={pt.bucketStart}
            className={`cbar ${i === active ? "sel" : ""}`}
            style={{ height: `${Math.max(4, (pt.volumeUsd / max) * 100)}%` }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </div>
      <div
        className="tip"
        style={{ left: `${((active + 0.5) / points.length) * 100}%` }}
      >
        <div className="tt">{hhmm(p.bucketStart)}</div>
        <div className="tl"><span>Volume</span><b>{usd(p.volumeUsd)}</b></div>
        <div className="tl"><span>Fees</span><b>{usd(p.feesUsd)}</b></div>
        <div className="tl">
          <span>Liq net</span>
          <b className={p.liquidityNetUsd >= 0 ? "up" : "down"}>{signedUsd(p.liquidityNetUsd)}</b>
        </div>
        <div className="tl"><span>Active pools</span><b>{p.activePools}</b></div>
      </div>
      <div className="chart-x">
        <span>{hhmm(points[0]!.bucketStart)}</span>
        <span>now</span>
      </div>
    </div>
  );
}

export function PulseView({ data }: { data: PulseData }) {
  const { overview: o, chart, pools, window } = data;

  if (pools.length === 0) {
    return (
      <>
        <WindowRow window={window} />
        <div className="empty">
          <div className="empty-dot" />
          <h3>Waiting for the first pulse</h3>
          <p>
            Active pools appear here — ranked by fees, with est. APR and trust
            signals — as soon as the ingest worker has run a few times.
          </p>
        </div>
      </>
    );
  }

  return (
    <>
      {/* overview */}
      <div className="stats">
        <div className="stat">
          <div className="k">Volume · {window}</div>
          <div className="v">{usd(o.volumeUsd)}</div>
          {o.volumeRatio > 0 && (
            <div className={`d ${o.volumeRatio >= 1 ? "up" : "down"}`}>
              {o.volumeRatio >= 1 ? "↑" : "↓"} {multiple(o.volumeRatio)} vs prior
            </div>
          )}
        </div>
        <div className="stat">
          <div className="k">Fees · {window}</div>
          <div className="v">{usd(o.feesUsd)}</div>
          {o.feesRatio > 0 && (
            <div className={`d ${o.feesRatio >= 1 ? "up" : "down"}`}>
              {o.feesRatio >= 1 ? "↑" : "↓"} {multiple(o.feesRatio)} vs prior
            </div>
          )}
        </div>
        <div className="stat">
          <div className="k">Active pools</div>
          <div className="v">{o.activePools}</div>
          {o.activePoolsDelta !== 0 && (
            <div className={`d ${o.activePoolsDelta >= 0 ? "up" : "down"}`}>
              {o.activePoolsDelta >= 0 ? "↑" : "↓"} {Math.abs(o.activePoolsDelta)} vs prior
            </div>
          )}
        </div>
      </div>

      {/* chart */}
      <div className="panel">
        <div className="panel-h">
          <div className="t">Chain money flow · hover a bar</div>
        </div>
        <Chart points={chart} />
      </div>

      {/* list */}
      <WindowRow window={window} count={pools.length} />
      <div className="hint">
        Flow columns follow the window. APR is a rough 24h estimate — your real APR
        depends on your range (see Positions).
      </div>
      <div className="rowh">
        <span>Pool</span><span>est. APR · 24h</span><span>Fees</span>
        <span>Volume</span><span>Liq net</span><span>Velocity</span>
      </div>
      {pools.map((p) => (
        <Link key={p.id} href={`/pool/${encodeURIComponent(p.id)}`} className="prow">
          <div>
            <span className="pair">
              {p.label}
              {p.feeTier !== null && <span className="fee">{feeTierPct(p.feeTier)}</span>}
            </span>
            <div className="prow-sub">
              <span className="dexmini">{p.dex.replace("uniswap-", "Uni ").toUpperCase()}</span>
              {p.risks.map((r) => (
                <span key={r} className={`risk ${r === "new-pool" ? "new" : ""}`}>
                  {RISK_LABELS[r]}
                </span>
              ))}
            </div>
          </div>
          <div className={`apr ${p.aprEst !== null ? "up" : "dim"}`}>{apr(p.aprEst)}</div>
          <div className="num">{usd(p.feesUsd)}</div>
          <div className="num">{usd(p.volumeUsd)}</div>
          <div className={`num ${p.liquidityNetUsd >= 0 ? "up" : "down"}`}>
            {signedUsd(p.liquidityNetUsd)}
          </div>
          <VelocityBadge label={p.velocity} ratio={p.velocityRatio} />
        </Link>
      ))}
    </>
  );
}

function WindowRow({ window, count }: { window: Window; count?: number }) {
  return (
    <div className="panel-h list-head">
      <div className="t">{count !== undefined ? `Active pools · ${count}` : "Window"}</div>
      <WindowFilter active={window} />
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PulseData, Segment, PoolRow } from "../lib/model";
import { WINDOWS } from "../lib/model";
import { usd, apr, feeTierPct, multiple, hhmm, RISK_LABELS } from "../lib/format";
import { ComboChart, type ComboPoint } from "./ComboChart";

const PER_PAGE = 10;
const PALETTE = ["#00c805", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#f87171", "#60a5fa", "#f59e0b", "#2dd4bf"];
function tokColor(sym: string): string {
  let h = 0;
  for (const c of sym) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}
function sparkPoints(vals: number[], w = 84, h = 28): string {
  if (vals.length < 2) return `0,${h} ${w},${h}`;
  const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
  return vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`).join(" ");
}
const RISK_CLASS: Record<string, string> = { "new-pool": "b-new", "thin-tvl": "b-thin", "one-wallet": "b-wallet", "few-traders": "b-thin" };

function Leaf() {
  return (
    <svg className="leaf" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M20 4C10 4 4 10 4 20c8 0 16-6 16-16Z" fill="#00c805" opacity="0.9" />
      <path d="M8 16C11 12 15 9 19 7" stroke="#08120a" strokeWidth="1.6" />
    </svg>
  );
}

function StatCard({ k, value, ratio, delta, spark }: {
  k: string; value: string; ratio?: number; delta?: number; spark: number[];
}) {
  const up = (ratio !== undefined && ratio >= 1) || (delta !== undefined && delta >= 0);
  const show = (ratio !== undefined && ratio > 0) || (delta !== undefined && delta !== 0);
  return (
    <div className="stat">
      <div>
        <div className="k">{k}</div>
        <div className="v">{value}</div>
        {show && (
          <div className={`d ${up ? "up" : "down"}`}>
            {up ? "▲" : "▼"}{" "}
            {ratio !== undefined ? `${multiple(ratio)} vs prior` : `${Math.abs(delta!)} vs prior`}
          </div>
        )}
      </div>
      <svg className="spark" viewBox="0 0 84 28" preserveAspectRatio="none">
        <polyline fill="none" stroke="#2fe04a" strokeWidth="2" points={sparkPoints(spark)} />
      </svg>
    </div>
  );
}

function HeatCard({ p }: { p: PoolRow }) {
  return (
    <Link href={`/pool/${encodeURIComponent(p.id)}`} className="heatcard">
      <div className="hc-top">
        <span className="tok sm" style={{ background: `radial-gradient(circle at 32% 28%, #ffffff88, ${tokColor(p.token0Symbol)})` }}>{p.token0Symbol.charAt(0)}</span>
        <span className="hc-pair">{p.label}</span>
        <span className="hc-flame">▲ {multiple(p.velocityRatio)}</span>
      </div>
      <div className="hc-row"><span>Fees · win</span><b>{usd(p.feesUsd)}</b></div>
      <div className="hc-row"><span>Volume</span><b>{usd(p.volumeUsd)}</b></div>
      <svg className="hc-spark" viewBox="0 0 120 26" preserveAspectRatio="none"><polyline fill="none" stroke="#2fe04a" strokeWidth="2" points={sparkPoints(p.spark, 120, 26)} /></svg>
    </Link>
  );
}

export function PulseView({ data }: { data: PulseData }) {
  const { overview: o, network: net, chart, pools, window } = data;
  const [seg, setSeg] = useState<Segment | "all">("all");
  const [page, setPage] = useState(0);
  const [ago, setAgo] = useState<string>("…");
  const [fresh, setFresh] = useState<string>("green");

  useEffect(() => {
    if (!data.updatedAt) { setAgo("no data yet"); setFresh("red"); return; }
    const m = Math.max(0, Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 60000));
    setAgo(m < 1 ? "just now" : `${m} min ago`);
    setFresh(m <= 10 ? "green" : m <= 30 ? "amber" : "red");
  }, [data.updatedAt]);

  const counts = useMemo(() => {
    const c = { stocks: 0, usd: 0, crypto: 0 };
    for (const p of pools) c[p.segment]++;
    return c;
  }, [pools]);

  const shown = seg === "all" ? pools : pools.filter((p) => p.segment === seg);
  const pageCount = Math.max(1, Math.ceil(shown.length / PER_PAGE));
  const curPage = Math.min(page, pageCount - 1);
  const pageRows = shown.slice(curPage * PER_PAGE, curPage * PER_PAGE + PER_PAGE);

  function pickSeg(s: Segment | "all") { setSeg(s); setPage(0); }

  const comboPoints: ComboPoint[] = chart.map((c) => ({
    label: hhmm(c.bucketStart), volume: c.volumeUsd, fees: c.feesUsd, meta: `${c.activePools} active pools`,
  }));
  const volSpark = chart.map((c) => c.volumeUsd);
  const feeSpark = chart.map((c) => c.feesUsd);
  const actSpark = chart.map((c) => c.activePools);
  const hot = pools.filter((p) => p.velocity === "ACCELERATING").sort((a, b) => b.velocityRatio - a.velocityRatio).slice(0, 3);

  return (
    <>
      <div className="top">
        <div>
          <h1>Pulse</h1>
          <p className="sub">What&apos;s moving on Robinhood Chain — real-time LP fees, flows, and the trust signals behind them.</p>
        </div>
        <div className="ctrls">
          <div className="chainpill"><Leaf /> Robinhood Chain</div>
          <div className="win">
            {WINDOWS.map((w) => (<Link key={w} href={`/?w=${w}`} className={w === window ? "on" : ""}>{w}</Link>))}
          </div>
          <div className="live"><span className={`dot ${fresh}`} /><b>Live</b><span className="upd">Updated<br />{ago}</span></div>
        </div>
      </div>

      {pools.length === 0 ? (
        <div className="empty">
          <div className="empty-dot" />
          <h3>Waiting for the first pulse</h3>
          <p>Active pools appear here — ranked by fees, with est. APR and trust signals — as the ingest worker fills in a few 5-minute windows.</p>
          <div className="win" style={{ marginTop: 16 }}>{WINDOWS.map((w) => (<Link key={w} href={`/?w=${w}`} className={w === window ? "on" : ""}>{w}</Link>))}</div>
        </div>
      ) : (
        <>
          <div className="stats">
            <StatCard k={`Volume · ${window}`} value={usd(o.volumeUsd)} ratio={o.volumeRatio} spark={volSpark} />
            <StatCard k={`Fees paid · ${window}`} value={usd(o.feesUsd)} ratio={o.feesRatio} spark={feeSpark} />
            <StatCard k="Active pools" value={String(o.activePools)} delta={o.activePoolsDelta} spark={actSpark} />
          </div>

          <div className="grid2">
            <div className="panel">
              <div className="panel-h"><div className="t">Chain volume &amp; fees<small>per 5-min bucket · last 3h</small></div></div>
              <ComboChart points={comboPoints} />
            </div>
            <div className="panel">
              <div className="panel-h"><div className="t">Network overview<small>Robinhood Chain · 24h</small></div></div>
              <div className="ov">
                <div className="ovrow"><span className="kk">Total volume</span><b>{usd(net.volumeUsd)}</b></div>
                <div className="ovrow"><span className="kk">Total fees</span><b>{usd(net.feesUsd)}</b></div>
                <div className="ovrow"><span className="kk">Active pools</span><b>{net.activePools}</b></div>
                <div className="ovrow"><span className="kk">Swaps</span><b>{net.swaps.toLocaleString()}</b></div>
              </div>
              <div className="callout">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8h.01" /></svg>
                <p>{hot.length > 0 ? (<>Heating fastest: <b>{hot.slice(0, 2).map((p) => p.label).join(" · ")}</b>. Ranked by fees, not our picks.</>) : (<>Activity is steady across tracked pools. Ranked by fees, never by our picks.</>)}</p>
              </div>
            </div>
          </div>

          {hot.length > 0 && (
            <>
              <div className="section-row"><span className="flame-dot" />Heating now<small>top pools by fee acceleration</small></div>
              <div className="heatgrid">{hot.map((p) => <HeatCard key={p.id} p={p} />)}</div>
            </>
          )}

          <div className="poolshead">
            <div className="t">Pools <small>{shown.length} active · ranked by fees</small></div>
            <div className="segs">
              <button className={`seg ${seg === "all" ? "on" : ""}`} onClick={() => pickSeg("all")}>All <span className="c">{pools.length}</span></button>
              <button className={`seg ${seg === "stocks" ? "on" : ""}`} onClick={() => pickSeg("stocks")}>Stocks <span className="c">{counts.stocks}</span></button>
              <button className={`seg ${seg === "usd" ? "on" : ""}`} onClick={() => pickSeg("usd")}>USD <span className="c">{counts.usd}</span></button>
              <button className={`seg ${seg === "crypto" ? "on" : ""}`} onClick={() => pickSeg("crypto")}>Crypto <span className="c">{counts.crypto}</span></button>
            </div>
          </div>

          <div className="tbl">
            <div className="th">
              <span>#</span><span>Pool</span><span className="col-dex">DEX</span><span>APR est.</span>
              <span>Volume</span><span className="col-fees">Fees</span><span className="col-liq">Liquidity</span>
              <span className="col-vel">Velocity</span><span className="col-trend">Trend</span><span>Status</span>
            </div>
            {pageRows.map((p, i) => (<PoolRowView key={p.id} p={p} rank={curPage * PER_PAGE + i + 1} />))}
          </div>

          {pageCount > 1 && (
            <div className="pager">
              <button className="pg" disabled={curPage === 0} onClick={() => setPage(curPage - 1)}>← Prev</button>
              <div className="pg-nums">
                {Array.from({ length: pageCount }).map((_, i) => (
                  <button key={i} className={`pg-n ${i === curPage ? "on" : ""}`} onClick={() => setPage(i)}>{i + 1}</button>
                ))}
              </div>
              <button className="pg" disabled={curPage >= pageCount - 1} onClick={() => setPage(curPage + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PoolRowView({ p, rank }: { p: PoolRow; rank: number }) {
  const cooling = p.velocity === "COOLING";
  const color = tokColor(p.token0Symbol);
  return (
    <Link href={`/pool/${encodeURIComponent(p.id)}`} className="tr">
      <div className="rk">{rank}</div>
      <div className="pool">
        <span className="tok" style={{ background: `radial-gradient(circle at 32% 28%, #ffffff88, ${color})` }}>{p.token0Symbol.charAt(0)}</span>
        <span className="nm">
          <span className="pair">{p.label}</span>
          <span className="meta">
            {p.feeTier !== null && <span className="fee">{feeTierPct(p.feeTier)}</span>}
            {p.risks.map((r) => (<span key={r} className={`badge ${RISK_CLASS[r] ?? "b-thin"}`}>{RISK_LABELS[r]}</span>))}
          </span>
        </span>
      </div>
      <div className="dex col-dex">
        <span className="di" style={{ background: p.dex.includes("v4") ? "#a78bfa" : "#f472b6" }}>U</span>
        {p.dex.replace("uniswap-", "Uni ").toUpperCase()}
      </div>
      <div className={`apr ${p.aprEst !== null ? "" : "dim"}`}>{apr(p.aprEst)}</div>
      <div className="num">{usd(p.volumeUsd)}</div>
      <div className="num col-fees">{usd(p.feesUsd)}</div>
      <div className="num col-liq">{p.tvlUsd !== null ? usd(p.tvlUsd) : "—"}</div>
      <div className="vel col-vel">{p.velocityRatio > 0 ? multiple(p.velocityRatio) : "—"}</div>
      <div className="col-trend">
        <svg width="80" height="28" viewBox="0 0 84 28" preserveAspectRatio="none"><polyline fill="none" stroke={cooling ? "#8fb6ff" : "#2fe04a"} strokeWidth="2" points={sparkPoints(p.spark)} /></svg>
      </div>
      <div><span className={`pill ${cooling ? "cool" : "active"}`}>{cooling ? "Cooling" : "Active"}</span></div>
    </Link>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PoolDetail as PoolDetailData, LivePool, PoolSignal } from "../lib/model";
import { usd, apr, usdPrice, feeTierPct, multiple, hhmm, RISK_LABELS } from "../lib/format";
import { ComboChart } from "./ComboChart";

const GT_BASE = "https://www.geckoterminal.com/robinhood";
const shortAddr = (a: string | null | undefined) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "—");

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      className="copy"
      onClick={(e) => {
        e.preventDefault();
        try { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); } catch { /* ignore */ }
      }}
    >
      {ok ? "✓ copied" : "copy"}
    </button>
  );
}

function AddrRow({ label, addr, kind }: { label: string; addr: string; kind: "pools" | "tokens" }) {
  return (
    <div className="addr-row">
      <span className="ar-l">{label}</span>
      <a className="ar-a" href={`${GT_BASE}/${kind}/${addr}`} target="_blank" rel="noreferrer">{shortAddr(addr)} ↗</a>
      <CopyBtn text={addr} />
    </div>
  );
}
const PALETTE = ["#00c805", "#22d3ee", "#a78bfa", "#f472b6", "#fbbf24", "#34d399", "#f87171", "#60a5fa", "#f59e0b", "#2dd4bf"];
function tokColor(sym: string): string {
  let n = 0;
  for (const c of sym) n = (n * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[n % PALETTE.length]!;
}
function sparkPoints(vals: number[], w = 84, h = 28): string {
  if (vals.length < 2) return `0,${h} ${w},${h}`;
  const max = Math.max(...vals), min = Math.min(...vals), span = max - min || 1;
  return vals.map((v, i) => `${((i / (vals.length - 1)) * w).toFixed(1)},${(h - ((v - min) / span) * h).toFixed(1)}`).join(" ");
}
const RISK_CLASS: Record<string, string> = { "new-pool": "b-new", "thin-tvl": "b-thin", "one-wallet": "b-wallet", "few-traders": "b-thin" };
const fmtTime = (iso: string) => (iso ? iso.slice(11, 19) : "—");
const shortHash = (h: string) => (h ? `${h.slice(0, 6)}…${h.slice(-4)}` : "—");

const TABS = ["Overview", "Volume & Fees", "Price & Volatility", "Risk", "Liquidity", "Concentration"] as const;
type Tab = (typeof TABS)[number];

export function PoolDetail({ detail, live, signals }: { detail: PoolDetailData; live: LivePool | null; signals: PoolSignal[] }) {
  const { summary: s, series, feeHorizons: h } = detail;
  const [tab, setTab] = useState<Tab>("Overview");
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    try {
      const set = JSON.parse(localStorage.getItem("nugget.watch") || "[]") as string[];
      setWatched(set.includes(s.id));
    } catch { /* ignore */ }
  }, [s.id]);

  function toggleWatch() {
    try {
      const set = new Set(JSON.parse(localStorage.getItem("nugget.watch") || "[]") as string[]);
      if (set.has(s.id)) set.delete(s.id); else set.add(s.id);
      localStorage.setItem("nugget.watch", JSON.stringify([...set]));
      setWatched(set.has(s.id));
    } catch { /* ignore */ }
  }

  const cooling = s.velocity === "COOLING";
  const gtPool = `${GT_BASE}/pools/${s.id}`;
  const addLpUrl = live?.token0Addr && live?.token1Addr
    ? `https://app.uniswap.org/#/add/${live.token0Addr}/${live.token1Addr}${s.feeTier ? `/${s.feeTier}` : ""}`
    : gtPool;
  const tvl = s.tvlUsd;
  const vol24 = s.volumeUsd;
  const fees24 = h.h6;
  const feeLiq = tvl ? (fees24 / tvl) * 100 : null;
  const volLiq = tvl ? vol24 / tvl : null;
  const volSpark = series.map((w) => w.volumeUsd);
  const feeSpark = series.map((w) => w.feesUsd);
  const uniq = live?.uniqueTraders ?? s.uniqueTraders;

  return (
    <>
      <div className="pd-crumb"><Link href="/">Pools</Link><span>›</span><span className="cur">{s.label}</span></div>

      <div className="pd-head">
        <div className="pd-id">
          <div className="pd-toks">
            <span className="tok" style={{ background: `radial-gradient(circle at 32% 28%, #ffffff88, ${tokColor(s.token0Symbol)})` }}>{s.token0Symbol.charAt(0)}</span>
            <span className="tok t2" style={{ background: `radial-gradient(circle at 32% 28%, #ffffff88, ${tokColor(s.token1Symbol)})` }}>{s.token1Symbol.charAt(0)}</span>
          </div>
          <div>
            <div className="dpair">{s.label}</div>
            <div className="dmeta">
              <span>Robinhood</span><span>·</span>
              <span>{s.dex.replace("uniswap-", "").toUpperCase()}</span>
              {s.feeTier !== null && <><span>·</span><span className="fee">{feeTierPct(s.feeTier)} fee</span></>}
              <span className={`pill ${cooling ? "cool" : "active"}`}>{cooling ? "Cooling" : "Active"}</span>
              {s.risks.map((r) => <span key={r} className={`badge ${RISK_CLASS[r] ?? "b-thin"}`}>{RISK_LABELS[r]}</span>)}
            </div>
          </div>
        </div>
        <div className="pd-actions">
          <button className={`watch-btn ${watched ? "on" : ""}`} onClick={toggleWatch}>
            {watched ? "★ Watching" : "☆ Watch"}
          </button>
          <a className="btn-ghost2" href={gtPool} target="_blank" rel="noreferrer">Open pool ↗</a>
          <a className="btn-add" href={addLpUrl} target="_blank" rel="noreferrer">Add liquidity ↗</a>
        </div>
      </div>

      <div className="pd-stats">
        <StatMini k="TVL (Liquidity)" v={tvl !== null ? usd(tvl) : "—"} spark={volSpark} up />
        <StatMini k="6h Volume" v={usd(vol24)} ratio={detail.summary.velocityRatio} spark={volSpark} up />
        <StatMini k="6h Fees" v={usd(fees24)} spark={feeSpark} up />
        <StatMini k="Fee / Liquidity" v={feeLiq !== null ? `${feeLiq.toFixed(2)}%` : "—"} spark={feeSpark} up />
      </div>

      <div className="pd-tabs">
        {TABS.map((t) => (
          <button key={t} className={`pd-tab ${t === tab ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="pd-grid">
        <div className="pd-main">
          {(tab === "Overview" || tab === "Volume & Fees") && (
            <div className="panel">
              <div className="panel-h"><div className="t">Volume &amp; Fees<small>per 5-min bucket · last {series.length} windows</small></div></div>
              <ComboChart points={series.map((w) => ({ label: hhmm(w.bucketStart), volume: w.volumeUsd, fees: w.feesUsd }))} height={200} />
              <div className="horizons" style={{ marginTop: 14 }}>
                {([["5m", h.m5], ["30m", h.m30], ["1h", h.h1], ["6h", h.h6]] as const).map(([k, v]) => (
                  <div className="horizon" key={k}><div className="hk">{k} fees</div><div className="hv">{usd(v)}</div></div>
                ))}
              </div>
            </div>
          )}

          {tab === "Price & Volatility" && (
            <div className="panel">
              <div className="panel-h"><div className="t">Price &amp; Volatility<small>{s.token0Symbol} in {s.token1Symbol}</small></div></div>
              <div className="big-price">{usdPrice(live?.priceLast ?? s.priceClose)}</div>
              <div className="chart-simple tall" style={{ marginTop: 14 }}>
                {series.map((w, i) => {
                  const prices = series.map((x) => x.priceClose ?? 0);
                  const mx = Math.max(1, ...prices), mn = Math.min(...prices.filter((p) => p > 0), mx);
                  const p = w.priceClose ?? mn; const hpc = ((p - mn) / (mx - mn || 1)) * 100;
                  return <div key={w.bucketStart} className={`b ${i === series.length - 1 ? "now" : ""}`} style={{ height: `${Math.max(3, hpc)}%` }} />;
                })}
              </div>
            </div>
          )}

          {tab === "Risk" && (
            <div className="panel">
              <div className="panel-h"><div className="t">Trust signals<small>is this APR real?</small></div></div>
              <TrustRows s={s} />
            </div>
          )}

          {(tab === "Liquidity" || tab === "Concentration") && (
            <Placeholder tab={tab} />
          )}

          {tab === "Overview" && (
            <>
              <div className="panel">
                <div className="panel-h"><div className="t">Price range &amp; liquidity<small>Uniswap {s.dex.replace("uniswap-", "")}</small></div></div>
                <div className="prl-price">Current price <b>{usdPrice(live?.priceLast ?? s.priceClose)}</b></div>
                <div className="prl-hist">
                  {Array.from({ length: 40 }).map((_, i) => {
                    const d = Math.abs(i - 20);
                    const hgt = Math.max(6, 92 * Math.exp(-(d * d) / 95));
                    const inband = i >= 14 && i <= 26;
                    return <div key={i} className={`prl-bar ${inband ? "in" : ""}`} style={{ height: `${hgt}%` }} />;
                  })}
                </div>
                <div className="prl-foot">
                  <span className="prl-legend"><i className="in" />Liquidity distribution</span>
                  <span className="soon-badge">estimate</span>
                </div>
                <div className="pd-soon-inline sm"><span className="soon-badge">Coming soon</span>Real tick-level distribution &amp; in-range % need liquidity-event ingest. The current price above is live.</div>
              </div>

              <div className="panel">
                <div className="panel-h"><div className="t">Key metrics<small>6h window · live</small></div></div>
                <div className="km">
                  <KM k="Buy / Sell ratio" v={live ? `${live.buys} / ${live.sells}` : null} />
                  <KM k="Avg swap size" v={live ? usd(live.avgUsd) : null} />
                  <KM k="Median swap size" v={live ? usd(live.medianUsd) : null} />
                  <KM k="Unique traders" v={uniq !== null ? String(uniq) : null} />
                  <KM k="Liquidity inflow (24h)" soon />
                  <KM k="Liquidity outflow (24h)" soon />
                  <KM k="Price impact (avg)" soon />
                </div>
              </div>

              <div className="panel liqflow">
                <div className="panel-h"><div className="t">Liquidity flow<small>net liquidity added / removed</small></div></div>
                <div className="pd-soon-inline">
                  <span className="soon-badge">Coming soon</span>
                  Needs mint / burn event ingest — one more Bitquery query. Turned off for now to keep the worker lean.
                </div>
              </div>

              <div className="panel">
                <div className="panel-h"><div className="t">Recent swaps<small>live from Bitquery · last {live?.windowHours ?? 6}h</small></div></div>
                {live && live.swaps.length > 0 ? (
                  <div className="swaps">
                    <div className="swap-h"><span>Time</span><span>Type</span><span>In</span><span>Out</span><span>Amount</span><span>Price</span><span>Tx</span></div>
                    {live.swaps.map((sw, i) => (
                      <div className="swap-r" key={i}>
                        <span className="mono">{fmtTime(sw.time)}</span>
                        <span className={`sw-type ${sw.type === "BUY" ? "buy" : "sell"}`}>{sw.type}</span>
                        <span>{sw.inSym}</span>
                        <span>{sw.outSym}</span>
                        <span className="num">{usd(sw.amountUsd)}</span>
                        <span className="num">{usdPrice(sw.priceUsd)}</span>
                        <span className="mono dim">{shortHash(sw.hash)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="pd-soon-inline">
                    <span className="soon-badge warn">Live feed off</span>
                    {live ? "No swaps in the last few hours." : "Add BITQUERY_API_KEY to the Vercel project to stream live swaps here."}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="pd-rail">
          <div className="panel">
            <div className="panel-h"><div className="t">Pool overview</div></div>
            <div className="ov">
              <div className="ovrow"><span className="kk">Total liquidity</span><b>{tvl !== null ? usd(tvl) : "—"}</b></div>
              <div className="ovrow"><span className="kk">6h volume</span><b>{usd(vol24)}</b></div>
              <div className="ovrow"><span className="kk">6h fees</span><b>{usd(fees24)}</b></div>
              <div className="ovrow"><span className="kk">APR (est.)</span><b className={s.aprEst !== null ? "green" : ""}>{apr(s.aprEst)}</b></div>
              <div className="ovrow"><span className="kk">Fee / liquidity</span><b>{feeLiq !== null ? `${feeLiq.toFixed(2)}%` : "—"}</b></div>
              <div className="ovrow"><span className="kk">Volume / liquidity</span><b>{volLiq !== null ? multiple(volLiq) : "—"}</b></div>
              <div className="ovrow"><span className="kk">Unique traders</span><b>{uniq !== null ? uniq : "—"}</b></div>
              <div className="ovrow"><span className="kk">Swaps (window)</span><b>{s.swaps.toLocaleString()}</b></div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-h"><div className="t">Recent signals</div></div>
            {signals.length > 0 ? (
              <div className="signals">
                {signals.map((sig, i) => (
                  <div className="sigrow" key={i}>
                    <span className={`sig-ic ${sig.tone}`} />
                    <div className="sig-body">
                      <div className="sig-top"><b>{sig.title}</b><span className={`sig-level ${sig.level.toLowerCase()}`}>{sig.level}</span></div>
                      <div className="sig-det">{sig.detail}</div>
                    </div>
                    <span className="sig-ago">{sig.ago}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="pd-soon-inline">Activity is steady — no notable signals right now.</div>
            )}
          </div>

          <div className="panel">
            <div className="panel-h"><div className="t">Token details</div></div>
            <div className="ov">
              <div className="ovrow"><span className="kk"><span className="tdot" style={{ background: tokColor(s.token0Symbol) }} />{s.token0Symbol}</span><b>{usdPrice(live?.priceLast ?? s.priceClose)}</b></div>
              <div className="ovrow"><span className="kk"><span className="tdot" style={{ background: tokColor(s.token1Symbol) }} />{s.token1Symbol}</span><b className="dim">quote</b></div>
            </div>
            <div className="addr-list">
              <AddrRow label="Pool" addr={s.id} kind="pools" />
              {live?.token0Addr && <AddrRow label={s.token0Symbol} addr={live.token0Addr} kind="tokens" />}
              {live?.token1Addr && <AddrRow label={s.token1Symbol} addr={live.token1Addr} kind="tokens" />}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function StatMini({ k, v, spark, ratio, up }: { k: string; v: string; spark: number[]; ratio?: number; up?: boolean }) {
  return (
    <div className="stat">
      <div>
        <div className="k">{k}</div>
        <div className="v">{v}</div>
        {ratio !== undefined && ratio > 0 && <div className={`d ${up ? "up" : "down"}`}>▲ {multiple(ratio)} vs prior</div>}
      </div>
      <svg className="spark" viewBox="0 0 84 28" preserveAspectRatio="none"><polyline fill="none" stroke="#2fe04a" strokeWidth="2" points={sparkPoints(spark)} /></svg>
    </div>
  );
}

function KM({ k, v, soon }: { k: string; v?: string | null; soon?: boolean }) {
  return (
    <div className="kmrow">
      <span className="kml">{k}</span>
      {soon ? <span className="soon-badge sm">soon</span> : <span className="kmv">{v ?? "—"}</span>}
    </div>
  );
}

function TrustRows({ s }: { s: PoolDetailData["summary"] }) {
  const rows: [string, string, string, string][] = [
    ["Volume from top wallet", s.topWalletPct !== null ? `${s.topWalletPct.toFixed(0)}%` : "—", s.topWalletPct === null ? "" : s.topWalletPct >= 60 ? "concentrated" : "healthy", s.topWalletPct === null ? "" : s.topWalletPct >= 60 ? "bad" : "ok"],
    ["Unique traders", s.uniqueTraders !== null ? String(s.uniqueTraders) : "—", s.uniqueTraders === null ? "" : s.uniqueTraders <= 2 ? "few traders" : "", s.uniqueTraders === null ? "" : s.uniqueTraders <= 2 ? "warn" : "ok"],
    ["Pool age", s.ageMinutes === null ? "—" : s.ageMinutes < 60 ? `${Math.round(s.ageMinutes)} min` : s.ageMinutes < 1440 ? `${Math.round(s.ageMinutes / 60)} h` : `${Math.round(s.ageMinutes / 1440)} d`, s.ageMinutes === null ? "" : s.ageMinutes < 60 ? "new pool" : "", s.ageMinutes === null ? "" : s.ageMinutes < 60 ? "warn" : "ok"],
    ["Liquidity depth (TVL)", s.tvlUsd !== null ? usd(s.tvlUsd) : "—", s.tvlUsd === null ? "" : s.tvlUsd < 25000 ? "thin < $25k" : "healthy", s.tvlUsd === null ? "" : s.tvlUsd < 25000 ? "warn" : "ok"],
  ];
  return (
    <div className="trust">
      {rows.map(([label, value, flag, cls]) => (
        <div className="trow" key={label}>
          <span className="tk">{label}</span>
          <span className="tv">{value}{flag && <span className={`tflag ${cls}`}>{flag}</span>}</span>
        </div>
      ))}
    </div>
  );
}

function Placeholder({ tab }: { tab: string }) {
  const copy: Record<string, string> = {
    Liquidity: "Liquidity distribution, in-range vs out-of-range, and active LP count need decoded mint / burn events. That's one more Bitquery query on the ingest worker — deliberately off for now to keep it lean.",
    Concentration: "Tick-level concentration needs per-position liquidity data. It'll land after the liquidity-event ingest is wired up.",
  };
  return (
    <div className="panel pd-placeholder">
      <div className="ph-ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0Z" /><path d="M12 8v4l3 2" /></svg>
      </div>
      <h3>{tab} — coming soon</h3>
      <p>{copy[tab]}</p>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { rangeHealth } from "../../src/lib/pulse";
import { price, usd, signedUsd } from "../../lib/format";
import { computePnl, humanDuration, type PnlResult } from "../../lib/pnl";

interface Position {
  id: string;
  label: string;
  lower: number;
  upper: number;
  current: number;
  // optional economics — unlock the P&L truth breakdown
  deposit?: number;
  entryPrice?: number;
  aprPct?: number;
  hours?: number;
  gasUsd?: number;
}

const KEY = "nugget.positions.v1";

function load(): Position[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Position[]) : [];
  } catch {
    return [];
  }
}
function save(p: Position[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* private mode — ignore */
  }
}

const num = (s: string): number | undefined => {
  const n = parseFloat(s);
  return isFinite(n) ? n : undefined;
};

// Animate a number from its previous value → target with an ease-out curve.
function useCountUp(target: number, ms = 750): number {
  const [val, setVal] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(origin + (target - origin) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return val;
}

// --- P&L truth breakdown (shared by position cards and the backtest) --------
function PnlBreakdown({ r, hideValue }: { r: PnlResult; hideValue?: boolean }) {
  const net = useCountUp(r.netVsHodl);
  return (
    <div className="pnl">
      <div className="pnl-head">
        <div>
          <div className="pnl-k">Net vs holding</div>
          <div className={`pnl-net ${r.netVsHodl >= 0 ? "pos" : "neg"}`}>
            {signedUsd(net)}
          </div>
        </div>
        <div className="pnl-verdict">
          {r.netVsHodl >= 0 ? (
            <span className="verdict good">LP was worth it</span>
          ) : (
            <span className="verdict bad">Behind holding</span>
          )}
        </div>
      </div>

      <div className="pnl-rows">
        <div className="pnl-row">
          <span>Fees earned</span>
          <b className="pos">{r.fees > 0 ? signedUsd(r.fees) : usd(0)}</b>
        </div>
        <div className="pnl-row">
          <span>
            Impermanent loss
            {r.concentrated && <em className="tag"> concentrated</em>}
          </span>
          <b className={r.ilUsd < 0 ? "neg" : ""}>
            {r.ilUsd < 0 ? signedUsd(r.ilUsd) : usd(0)}
            <em className="tag"> {r.ilPct.toFixed(2)}%</em>
          </b>
        </div>
        <div className="pnl-row">
          <span>Gas</span>
          <b className={r.gas > 0 ? "neg" : ""}>{r.gas > 0 ? signedUsd(-r.gas) : usd(0)}</b>
        </div>
      </div>

      {!hideValue && (
        <div className="pnl-foot">
          <span>
            Position now <b>{usd(r.positionValue)}</b>
          </span>
          <span>
            If held <b>{usd(r.hodlValue)}</b>
          </span>
          <span>
            Price <b className={r.priceChangePct >= 0 ? "pos" : "neg"}>
              {r.priceChangePct >= 0 ? "+" : ""}
              {r.priceChangePct.toFixed(1)}%
            </b>
          </span>
        </div>
      )}
    </div>
  );
}

function RangeHealthView({ p, index }: { p: Position; index: number }) {
  const rh = rangeHealth(p.current, p.lower, p.upper);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 40);
    return () => clearTimeout(t);
  }, []);

  const pct = Math.min(100, Math.max(0, rh.pctThroughRange));
  const through = useCountUp(rh.pctThroughRange);
  const toLower = useCountUp(rh.distToLowerPct);
  const toUpper = useCountUp(rh.distToUpperPct);

  const hasEcon =
    typeof p.deposit === "number" && typeof p.entryPrice === "number";
  const pnl = hasEcon
    ? computePnl({
        deposit: p.deposit!,
        entryPrice: p.entryPrice!,
        currentPrice: p.current,
        aprPct: p.aprPct ?? 0,
        hours: p.hours ?? 0,
        gasUsd: p.gasUsd ?? 0,
        lower: p.lower,
        upper: p.upper,
      })
    : null;

  return (
    <div className="panel pos-card" style={{ marginBottom: 12, animationDelay: `${index * 80}ms` }}>
      <div className="card-top">
        <div className="pair" style={{ fontSize: 17 }}>
          {p.label || "Position"}
        </div>
        <span className={`pill ${rh.inRange ? "inrange" : "outrange"}`}>
          {rh.inRange ? "IN RANGE" : "OUT OF RANGE"}
        </span>
      </div>

      <div className={`rangebar ${rh.inRange ? "" : "out"}`}>
        <div className="fill" style={{ width: `${ready ? pct : 0}%` }} />
        <div className="marker" style={{ left: `${ready ? pct : 0}%` }} />
      </div>
      <div className="range-ends">
        <span>lower {price(p.lower)}</span>
        <span>now {price(p.current)}</span>
        <span>upper {price(p.upper)}</span>
      </div>

      <div className="metrics" style={{ marginTop: 18 }}>
        <div className="metric">
          <div className="k">Through range</div>
          <div className="v">{through.toFixed(0)}%</div>
        </div>
        <div className="metric">
          <div className="k">To lower</div>
          <div className={`v ${rh.distToLowerPct < 3 ? "neg" : ""}`}>
            {rh.distToLowerPct >= 0 ? "-" : "+"}
            {Math.abs(toLower).toFixed(1)}%
          </div>
        </div>
        <div className="metric">
          <div className="k">To upper</div>
          <div className={`v ${rh.distToUpperPct < 3 ? "neg" : ""}`}>+{Math.abs(toUpper).toFixed(1)}%</div>
        </div>
        <div className="metric">
          <div className="k">Status</div>
          <div className={`v ${rh.inRange ? "pos" : "neg"}`}>{rh.inRange ? "Earning" : "Idle"}</div>
        </div>
      </div>

      {!rh.inRange && (
        <div className="il-warn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            <path d="M12 9v4M12 17h.01" />
          </svg>
          <div>
            <b>Price left your range.</b> You&apos;re earning no fees right now and
            fully exposed to one side — impermanent loss keeps growing until price
            returns or you rebalance.
          </div>
        </div>
      )}

      {pnl ? (
        <>
          <div className="pnl-sep">P&amp;L truth · {humanDuration(p.hours ?? 0)} held</div>
          <PnlBreakdown r={pnl} />
        </>
      ) : (
        <div className="pnl-hint">
          Add deposit, entry price, fee APR and hours held (Edit) to see this
          position&apos;s <b>fees − IL − gas</b> net.
        </div>
      )}
    </div>
  );
}

// --- Backtest ---------------------------------------------------------------
function Backtest() {
  const [deposit, setDeposit] = useState("");
  const [entry, setEntry] = useState("");
  const [now, setNow] = useState("");
  const [apr, setApr] = useState("");
  const [hours, setHours] = useState("");
  const [gas, setGas] = useState("");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [result, setResult] = useState<PnlResult | null>(null);

  function run() {
    const d = num(deposit);
    const e = num(entry);
    const n = num(now);
    if (d === undefined || e === undefined || n === undefined || d <= 0 || e <= 0) {
      setResult(null);
      return;
    }
    setResult(
      computePnl({
        deposit: d,
        entryPrice: e,
        currentPrice: n,
        aprPct: num(apr) ?? 0,
        hours: num(hours) ?? 0,
        gasUsd: num(gas) ?? 0,
        lower: num(lower),
        upper: num(upper),
      }),
    );
  }

  return (
    <div className="panel pos-panel">
      <div className="bt-lead">
        <b>What if I&apos;d LP&apos;d here?</b> Model a position after the fact —
        deposit, the price when you&apos;d have entered, the price now — and NUGGET
        settles the honest score: <em>fees − IL − gas</em>.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label className="field">Deposit (USD)</label>
          <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="1000" />
        </div>
        <div>
          <label className="field">Fee APR %</label>
          <input value={apr} onChange={(e) => setApr(e.target.value)} inputMode="decimal" placeholder="42" />
        </div>
        <div>
          <label className="field">Entry price</label>
          <input value={entry} onChange={(e) => setEntry(e.target.value)} inputMode="decimal" placeholder="3100" />
        </div>
        <div>
          <label className="field">Price now</label>
          <input value={now} onChange={(e) => setNow(e.target.value)} inputMode="decimal" placeholder="3284" />
        </div>
        <div>
          <label className="field">Hours ago</label>
          <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="72" />
        </div>
        <div>
          <label className="field">Gas paid (USD)</label>
          <input value={gas} onChange={(e) => setGas(e.target.value)} inputMode="decimal" placeholder="4" />
        </div>
        <div>
          <label className="field">Range lower <em className="tag">optional</em></label>
          <input value={lower} onChange={(e) => setLower(e.target.value)} inputMode="decimal" placeholder="full range" />
        </div>
        <div>
          <label className="field">Range upper <em className="tag">optional</em></label>
          <input value={upper} onChange={(e) => setUpper(e.target.value)} inputMode="decimal" placeholder="full range" />
        </div>
      </div>
      <button className="go" onClick={run}>
        Run backtest
      </button>

      {result && (
        <div style={{ marginTop: 14 }}>
          <PnlBreakdown r={result} />
        </div>
      )}
    </div>
  );
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [label, setLabel] = useState("");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [current, setCurrent] = useState("");
  const [showEcon, setShowEcon] = useState(false);
  const [deposit, setDeposit] = useState("");
  const [entryPrice, setEntryPrice] = useState("");
  const [aprPct, setAprPct] = useState("");
  const [hours, setHours] = useState("");
  const [gasUsd, setGasUsd] = useState("");

  useEffect(() => setPositions(load()), []);

  function reset() {
    setLabel(""); setLower(""); setUpper(""); setCurrent("");
    setDeposit(""); setEntryPrice(""); setAprPct(""); setHours(""); setGasUsd("");
    setShowEcon(false);
  }

  function add() {
    const lo = parseFloat(lower);
    const up = parseFloat(upper);
    const cur = parseFloat(current);
    if (!isFinite(lo) || !isFinite(up) || !isFinite(cur) || up <= lo) return;
    const next: Position[] = [
      ...positions,
      {
        id: crypto.randomUUID(),
        label: label.trim(),
        lower: lo,
        upper: up,
        current: cur,
        deposit: num(deposit),
        entryPrice: num(entryPrice),
        aprPct: num(aprPct),
        hours: num(hours),
        gasUsd: num(gasUsd),
      },
    ];
    setPositions(next);
    save(next);
    reset();
  }

  function remove(id: string) {
    const next = positions.filter((p) => p.id !== id);
    setPositions(next);
    save(next);
  }

  return (
    <div className="narrow">
      <div className="page-head">
        <h1>Positions</h1>
        <p>
          Monitor a liquidity position you already hold and see its real score —
          fees minus impermanent loss minus gas. No wallet connect; saved on this
          device only.
        </p>
      </div>

      <div className="section-label">Add a position</div>
      <div className="panel pos-panel">
        <label className="field">Label</label>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. WETH/USDG tight" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <div>
            <label className="field">Lower</label>
            <input value={lower} onChange={(e) => setLower(e.target.value)} inputMode="decimal" placeholder="3100" />
          </div>
          <div>
            <label className="field">Upper</label>
            <input value={upper} onChange={(e) => setUpper(e.target.value)} inputMode="decimal" placeholder="3450" />
          </div>
          <div>
            <label className="field">Current price</label>
            <input value={current} onChange={(e) => setCurrent(e.target.value)} inputMode="decimal" placeholder="3284" />
          </div>
        </div>

        <button className="econ-toggle" onClick={() => setShowEcon((v) => !v)}>
          {showEcon ? "− Hide" : "+ Add"} economics <em className="tag">for P&amp;L truth</em>
        </button>

        {showEcon && (
          <div className="econ-fields">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label className="field">Deposit (USD)</label>
                <input value={deposit} onChange={(e) => setDeposit(e.target.value)} inputMode="decimal" placeholder="1000" />
              </div>
              <div>
                <label className="field">Entry price</label>
                <input value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} inputMode="decimal" placeholder="3200" />
              </div>
              <div>
                <label className="field">Fee APR %</label>
                <input value={aprPct} onChange={(e) => setAprPct(e.target.value)} inputMode="decimal" placeholder="42" />
              </div>
              <div>
                <label className="field">Hours held</label>
                <input value={hours} onChange={(e) => setHours(e.target.value)} inputMode="decimal" placeholder="72" />
              </div>
              <div>
                <label className="field">Gas paid (USD)</label>
                <input value={gasUsd} onChange={(e) => setGasUsd(e.target.value)} inputMode="decimal" placeholder="4" />
              </div>
            </div>
            <p className="econ-note">
              APR and price you can read off the pool page. Fees are estimated
              from the APR while the position is in range — everything else is
              exact.
            </p>
          </div>
        )}

        <button className="go" onClick={add}>
          Add position
        </button>
      </div>

      <div className="section-label">Monitored positions</div>
      {positions.length === 0 ? (
        <div className="panel" style={{ color: "var(--muted)" }}>
          No positions yet. Add one above to see its range health and P&amp;L truth.
        </div>
      ) : (
        positions.map((p, i) => (
          <div key={p.id}>
            <RangeHealthView p={p} index={i} />
            <div style={{ textAlign: "right", marginTop: -8, marginBottom: 14 }}>
              <button className="ghost" onClick={() => remove(p.id)}>
                Remove
              </button>
            </div>
          </div>
        ))
      )}

      <div className="section-label">Backtest</div>
      <Backtest />

      <p className="note">
        P&amp;L is the truth a single APR hides: a pool can pay well and still leave
        you behind holding once price drifts. Impermanent loss is computed exactly
        from your range and prices; fees are an estimate from the pool APR and only
        accrue while you&apos;re in range. Not financial advice.
      </p>
    </div>
  );
}

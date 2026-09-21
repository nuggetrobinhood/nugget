"use client";

import { useEffect, useRef, useState } from "react";
import { rangeHealth } from "../../src/lib/pulse";
import { price } from "../../lib/format";

interface Position {
  id: string;
  label: string;
  lower: number;
  upper: number;
  current: number;
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

// Animate a number from 0 → target with an ease-out curve on mount / change.
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
    </div>
  );
}

export default function PositionsPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [label, setLabel] = useState("");
  const [lower, setLower] = useState("");
  const [upper, setUpper] = useState("");
  const [current, setCurrent] = useState("");

  useEffect(() => setPositions(load()), []);

  function add() {
    const lo = parseFloat(lower);
    const up = parseFloat(upper);
    const cur = parseFloat(current);
    if (!isFinite(lo) || !isFinite(up) || !isFinite(cur) || up <= lo) return;
    const next: Position[] = [
      ...positions,
      { id: crypto.randomUUID(), label: label.trim(), lower: lo, upper: up, current: cur },
    ];
    setPositions(next);
    save(next);
    setLabel("");
    setLower("");
    setUpper("");
    setCurrent("");
  }

  function remove(id: string) {
    const next = positions.filter((p) => p.id !== id);
    setPositions(next);
    save(next);
  }

  return (
    <>
      <div className="narrow">
        <div className="page-head">
          <h1>Positions</h1>
          <p>
            Monitor a liquidity position you already hold. Paste its range and see
            how close it is to going idle. No wallet connect — saved on this
            device only.
          </p>
        </div>

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
          <button className="go" onClick={add}>
            Add position
          </button>
        </div>

        <div className="section-label">Monitored positions</div>
        {positions.length === 0 ? (
          <div className="panel" style={{ color: "var(--muted)" }}>
            No positions yet. Add one above to see its range health.
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

        <p className="note">
          V1 uses a price you paste. Next: auto-fill current price from live
          pulse, then add time-in-range and net P&amp;L (fees − IL) from your
          on-chain position.
        </p>
      </div>
    </>
  );
}

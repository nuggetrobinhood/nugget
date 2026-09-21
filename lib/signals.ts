// Pool signals — the "what just happened here" feed, computed from the stored
// 5-minute rollups (no extra ingest). Honest: only signals we can actually
// derive from swaps + price. Liquidity-flow signals wait on mint/burn ingest.
import type { PoolDetail, PoolSignal } from "./model";
import { multiple } from "./format";

function agoLabel(iso: string | undefined): string {
  if (!iso) return "recent";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.round(m / 60)}h ago`;
}

export function computePoolSignals(detail: PoolDetail): PoolSignal[] {
  const { summary: s, series, feeHorizons: h } = detail;
  const out: PoolSignal[] = [];
  const lastTs = series.length ? series[series.length - 1]!.bucketStart : undefined;
  const ago = agoLabel(lastTs);

  // 1. Fee / volume velocity (from the smoothed classifier)
  if (s.velocity === "ACCELERATING") {
    out.push({
      title: "Fee acceleration",
      detail: `Fees ${multiple(s.velocityRatio)} vs 1h baseline`,
      level: s.velocityRatio >= 2.4 ? "SIGNIFICANT" : "INFO",
      tone: "good",
      ago,
    });
  } else if (s.velocity === "COOLING") {
    out.push({
      title: "Activity cooling",
      detail: `Fees ${multiple(s.velocityRatio)} vs 1h baseline`,
      level: "WATCH",
      tone: "warn",
      ago,
    });
  }

  // 2. Fee growth — last 1h vs the prior ~1h (derived from horizons)
  const prior1h = Math.max(0, (h.h6 - h.h1) / 5);
  if (prior1h > 0 && h.h1 > 0) {
    const g = (h.h1 - prior1h) / prior1h;
    if (Math.abs(g) >= 0.1) {
      out.push({
        title: g >= 0 ? "Fee growth" : "Fee decline",
        detail: `${g >= 0 ? "+" : ""}${(g * 100).toFixed(0)}% fees vs prior hour`,
        level: Math.abs(g) >= 0.5 ? "SIGNIFICANT" : "INFO",
        tone: g >= 0 ? "good" : "warn",
        ago,
      });
    }
  }

  // 3. Volatility — price swing across the fetched series
  const prices = series.map((w) => w.priceClose).filter((p): p is number => p !== null && p > 0);
  if (prices.length >= 3) {
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const swing = (max - min) / min;
    if (swing >= 0.05) {
      out.push({
        title: "Volatility expansion",
        detail: `${(swing * 100).toFixed(1)}% price range in window`,
        level: swing >= 0.15 ? "SIGNIFICANT" : "INFO",
        tone: "warn",
        ago,
      });
    }
  }

  // 4. Trust flags surfaced as signals
  if (s.risks.includes("one-wallet")) {
    out.push({ title: "Concentration risk", detail: `${s.topWalletPct?.toFixed(0)}% volume from one wallet`, level: "WATCH", tone: "warn", ago });
  }
  if (s.risks.includes("thin-tvl")) {
    out.push({ title: "Thin liquidity", detail: "TVL below $25k — APR is fragile", level: "WATCH", tone: "warn", ago });
  }
  if (s.risks.includes("new-pool")) {
    out.push({ title: "New pool", detail: "Live under an hour — little history yet", level: "INFO", tone: "info", ago });
  }

  return out;
}

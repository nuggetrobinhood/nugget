// Pure functions for turning events into 5-minute rollups and for the velocity
// classifier. No IO here, so this file is unit-testable and shared with the
// frontend (which reuses the velocity math to label pools).

import type { PoolEvent, Pulse5m } from "./types";

/** Align a unix-seconds timestamp down to the start of its bucket. */
export function bucketStart(unixSeconds: number, bucketSeconds: number): number {
  return Math.floor(unixSeconds / bucketSeconds) * bucketSeconds;
}

/**
 * Group events into per-pool, per-window rollups.
 * Returns a map keyed by `${poolId}@${bucketStartIso}`.
 */
export function rollupEvents(
  events: PoolEvent[],
  bucketSeconds: number,
): Pulse5m[] {
  type Acc = Pulse5m & {
    _lps: Set<string>;
    _traderVol: Map<string, number>; // trader -> volume, for top-wallet %
    _bucketTs: number;
  };
  const acc = new Map<string, Acc>();

  for (const e of events) {
    const bTs = bucketStart(e.timestamp, bucketSeconds);
    const bIso = new Date(bTs * 1000).toISOString();
    const key = `${e.poolId}@${bIso}`;
    let a = acc.get(key);
    if (!a) {
      a = {
        poolId: e.poolId,
        bucketStart: bIso,
        feesUsd: 0,
        volumeUsd: 0,
        liquidityAddUsd: 0,
        liquidityRmUsd: 0,
        swapCount: 0,
        mintCount: 0,
        burnCount: 0,
        lpCount: null,
        uniqueTraders: null,
        topWalletPct: null,
        priceOpen: null,
        priceClose: null,
        activeLiquidity: null,
        _lps: new Set<string>(),
        _traderVol: new Map<string, number>(),
        _bucketTs: bTs,
      };
      acc.set(key, a);
    }

    if (e.kind === "swap") {
      a.volumeUsd += e.amountUsd;
      a.feesUsd += e.feeUsd;
      a.swapCount += 1;
      if (e.trader) {
        a._traderVol.set(e.trader, (a._traderVol.get(e.trader) ?? 0) + e.amountUsd);
      }
    } else if (e.kind === "mint") {
      a.liquidityAddUsd += e.amountUsd;
      a.mintCount += 1;
      if (e.lpAddress) a._lps.add(e.lpAddress);
    } else {
      a.liquidityRmUsd += e.amountUsd;
      a.burnCount += 1;
      if (e.lpAddress) a._lps.add(e.lpAddress);
    }

    if (typeof e.priceToken0InToken1 === "number") {
      // events arrive in ascending time order within a window, so first sets
      // open, last wins close.
      if (a.priceOpen === null) a.priceOpen = e.priceToken0InToken1;
      a.priceClose = e.priceToken0InToken1;
    }
  }

  return [...acc.values()].map(({ _lps, _traderVol, _bucketTs, ...row }) => {
    let topWalletPct: number | null = null;
    if (_traderVol.size > 0 && row.volumeUsd > 0) {
      const maxVol = Math.max(..._traderVol.values());
      topWalletPct = (maxVol / row.volumeUsd) * 100;
    }
    return {
      ...row,
      lpCount: _lps.size > 0 ? _lps.size : null,
      uniqueTraders: _traderVol.size > 0 ? _traderVol.size : null,
      topWalletPct,
    };
  });
}

/** Estimated pool APR from 24h fees and current TVL. Null if TVL unknown. */
export function estApr24h(fees24hUsd: number, tvlUsd: number | null | undefined): number | null {
  if (!tvlUsd || tvlUsd <= 0) return null;
  // annualize: 24h fee × 365, as a % of TVL
  return (fees24hUsd * 365) / tvlUsd * 100;
}

export type RiskFlag = "thin-tvl" | "one-wallet" | "few-traders" | "new-pool";

/**
 * Trust signals — the "is this APR real?" layer. Returns the risk flags that
 * apply so the UI can warn instead of just showing a juicy number.
 */
export function riskFlags(input: {
  tvlUsd: number | null;
  topWalletPct: number | null;
  uniqueTraders: number | null;
  poolAgeMinutes: number | null;
}): RiskFlag[] {
  const flags: RiskFlag[] = [];
  if (input.tvlUsd !== null && input.tvlUsd < 25_000) flags.push("thin-tvl");
  if (input.topWalletPct !== null && input.topWalletPct >= 60) flags.push("one-wallet");
  if (input.uniqueTraders !== null && input.uniqueTraders <= 2) flags.push("few-traders");
  if (input.poolAgeMinutes !== null && input.poolAgeMinutes < 60) flags.push("new-pool");
  return flags;
}

export type VelocityLabel = "ACCELERATING" | "STABLE" | "COOLING";

/**
 * Velocity classifier. Compares the current window's fee rate against a longer
 * rolling baseline (per-window average over the baseline window).
 *
 * IMPORTANT: raw 5m ratios are noisy — one big swap spikes them. We therefore
 * smooth by comparing to an average-per-window baseline and apply a deadband
 * so the label doesn't flicker on every refresh.
 *
 * @param current   value in the latest window (e.g. fees_usd)
 * @param baselineAvgPerWindow  mean value per window over the baseline period
 */
export function classifyVelocity(
  current: number,
  baselineAvgPerWindow: number,
  opts: { accelAt?: number; coolAt?: number; minSignal?: number } = {},
): { label: VelocityLabel; ratio: number } {
  const accelAt = opts.accelAt ?? 1.6; // >=1.6x baseline -> accelerating
  const coolAt = opts.coolAt ?? 0.6; //  <=0.6x baseline -> cooling
  const minSignal = opts.minSignal ?? 1e-9;

  if (baselineAvgPerWindow <= minSignal) {
    // no baseline to compare to; treat any activity as stable, none as cooling
    return { label: current > minSignal ? "STABLE" : "COOLING", ratio: 0 };
  }
  const ratio = current / baselineAvgPerWindow;
  if (ratio >= accelAt) return { label: "ACCELERATING", ratio };
  if (ratio <= coolAt) return { label: "COOLING", ratio };
  return { label: "STABLE", ratio };
}

/** Fee-generation totals across standard horizons, for the Fee Velocity view. */
export interface FeeHorizons {
  m5: number;
  m30: number;
  h1: number;
  h6: number;
  h24: number;
}

/** Range health for a concentrated-liquidity position (v3). */
export function rangeHealth(
  price: number,
  lower: number,
  upper: number,
): {
  inRange: boolean;
  pctThroughRange: number; // 0 = at lower, 100 = at upper
  distToLowerPct: number;
  distToUpperPct: number;
} {
  const inRange = price >= lower && price <= upper;
  const span = upper - lower;
  const pctThroughRange =
    span > 0 ? Math.min(100, Math.max(0, ((price - lower) / span) * 100)) : 0;
  return {
    inRange,
    pctThroughRange,
    distToLowerPct: ((price - lower) / price) * 100,
    distToUpperPct: ((upper - price) / price) * 100,
  };
}

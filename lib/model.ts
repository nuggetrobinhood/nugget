// View models the frontend renders. Kept separate from the DB row shape so the
// UI doesn't care whether data came from Supabase or a fallback.
import type { VelocityLabel, RiskFlag } from "../src/lib/pulse";

export type Window = "5m" | "30m" | "1h" | "24h";
export const WINDOWS: Window[] = ["5m", "30m", "1h", "24h"];

/** One 5-minute bucket in the chain-wide money-flow chart. */
export interface ChartPoint {
  bucketStart: string;
  volumeUsd: number;
  feesUsd: number;
  liquidityNetUsd: number;
  activePools: number;
}

/** Chain-wide overview for the selected window. */
export interface Overview {
  window: Window;
  volumeUsd: number;
  feesUsd: number;
  activePools: number;
  volumeRatio: number; // vs baseline (prior equivalent window)
  feesRatio: number;
  activePoolsDelta: number;
}

/** A pool row in the Active pools list, for the selected window. */
export interface PoolRow {
  id: string;
  dex: string;
  label: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTier: number | null;

  feesUsd: number;
  volumeUsd: number;
  liquidityNetUsd: number;
  swaps: number;

  velocity: VelocityLabel;
  velocityRatio: number;

  aprEst: number | null; // est. APR, always 24h-based
  tvlUsd: number | null;
  risks: RiskFlag[];

  priceClose: number | null;
}

export interface PulseData {
  window: Window;
  overview: Overview;
  chart: ChartPoint[];
  pools: PoolRow[];
}

// re-export so pages can import from one place
export type { VelocityLabel, RiskFlag } from "../src/lib/pulse";

// legacy shapes still used by the pool-detail + positions pages
export interface PulseWindow {
  bucketStart: string;
  feesUsd: number;
  volumeUsd: number;
  liquidityNetUsd: number;
  swapCount: number;
  priceClose: number | null;
}

export interface FeeHorizons {
  m5: number;
  m30: number;
  h1: number;
  h6: number;
  h24: number;
}

export interface PoolDetail {
  summary: PoolRow;
  series: PulseWindow[];
  feeHorizons: FeeHorizons;
}

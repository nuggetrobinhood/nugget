// View models the frontend renders. Kept separate from the DB row shape so the
// UI doesn't care whether data came from Supabase or a fallback.
import type { VelocityLabel, RiskFlag } from "../src/lib/pulse";

export type Window = "5m" | "30m" | "1h" | "24h";
export const WINDOWS: Window[] = ["5m", "30m", "1h", "24h"];

/** Asset segment for the All / Stocks / USD / Crypto tabs. */
export type Segment = "stocks" | "usd" | "crypto";
export const SEGMENTS: Segment[] = ["stocks", "usd", "crypto"];

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

/** 24h network totals (independent of the selected window). */
export interface Network {
  volumeUsd: number;
  feesUsd: number;
  activePools: number;
  swaps: number;
}

/** A pool row in the Active pools list, for the selected window. */
export interface PoolRow {
  id: string;
  dex: string;
  label: string;
  token0Symbol: string;
  token1Symbol: string;
  feeTier: number | null;
  segment: Segment;

  feesUsd: number;
  volumeUsd: number;
  liquidityNetUsd: number;
  swaps: number;

  velocity: VelocityLabel;
  velocityRatio: number;

  aprEst: number | null; // est. APR, always 24h-based
  tvlUsd: number | null;
  risks: RiskFlag[];

  topWalletPct: number | null;
  uniqueTraders: number | null;
  ageMinutes: number | null;

  spark: number[]; // recent volume-per-bucket, for the row trend sparkline
  priceClose: number | null;
}

export interface PulseData {
  window: Window;
  overview: Overview;
  network: Network;
  chart: ChartPoint[];
  pools: PoolRow[];
  updatedAt: string | null; // latest bucket start (ISO) — for the freshness dot
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

// --- live (on-demand Bitquery, per-pool) -----------------------------------
export interface LiveSwap {
  time: string; // ISO
  type: "BUY" | "SELL";
  inSym: string;
  outSym: string;
  amountUsd: number;
  priceUsd: number | null;
  hash: string;
  trader: string;
}
export interface LivePool {
  swaps: LiveSwap[];
  buys: number;
  sells: number;
  avgUsd: number;
  medianUsd: number;
  priceLast: number | null;
  uniqueTraders: number;
  windowHours: number;
}

// --- ticker (top price marquee) --------------------------------------------
export interface TickerItem {
  sym: string;
  quote: string;
  price: number;
  usd: boolean; // true when the quote token is a USD stable (price ≈ USD)
}

// --- signals (computed from stored data) -----------------------------------
export interface PoolSignal {
  title: string;
  detail: string;
  level: "SIGNIFICANT" | "INFO" | "WATCH";
  tone: "good" | "warn" | "info";
  ago: string;
}

// --- asset classification --------------------------------------------------
// Tokenized equities live on Robinhood Chain alongside crypto. We bucket a pool
// by its tokens so the Stocks / USD / Crypto tabs work. Best-effort: a curated
// stock set + USD-stable set, everything else is crypto.
const STOCK_TOKENS = new Set([
  "GME", "AAPL", "TSLA", "NVDA", "AMZN", "MSFT", "META", "GOOGL", "GOOG",
  "AMD", "HOOD", "SPY", "QQQ", "COIN", "MSTR", "NFLX", "PLTR", "F", "NKE",
  "DIS", "BA", "INTC", "TDESK",
]);
const USD_TOKENS = new Set([
  "USDG", "USDB", "USDC", "USDT", "DAI", "USD", "FRAX", "GHO", "USDE", "PYUSD",
]);

export function classifySegment(sym0: string, sym1: string): Segment {
  const a = sym0.toUpperCase();
  const b = sym1.toUpperCase();
  if (STOCK_TOKENS.has(a) || STOCK_TOKENS.has(b)) return "stocks";
  if (USD_TOKENS.has(a) || USD_TOKENS.has(b)) return "usd";
  return "crypto";
}

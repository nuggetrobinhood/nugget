// The frontend's single data entrypoint. Reads Supabase when configured;
// before that it returns empty results and pages show a clean empty state.
// Server-side only.
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, HAS_SUPABASE } from "./env";
import { classifyVelocity, estApr24h, riskFlags } from "../src/lib/pulse";
import { classifySegment } from "./model";
import type {
  Window,
  PulseData,
  Overview,
  Network,
  ChartPoint,
  PoolRow,
  PoolDetail,
  PulseWindow,
  FeeHorizons,
  TickerItem,
} from "./model";

const CHART_BUCKETS = 36; // last 3h on the money-flow chart

function windowBuckets(w: Window): number {
  return { "5m": 1, "30m": 6, "1h": 12, "24h": 288 }[w];
}

function client() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
}

interface PulseRowDb {
  pool_id: string;
  bucket_start: string;
  fees_usd: number;
  volume_usd: number;
  liquidity_net_usd: number;
  swap_count: number;
  unique_traders: number | null;
  top_wallet_pct: number | null;
  price_close: number | null;
}
interface PoolDb {
  id: string;
  dex: string;
  token0_symbol: string;
  token1_symbol: string;
  fee_tier: number | null;
  tvl_usd: number | null;
  first_seen: string;
}
interface Bucket {
  t: string;
  fees: number;
  volume: number;
  liqNet: number;
  swaps: number;
  traders: number | null;
  topWallet: number | null;
  price: number | null;
}

const EMPTY_NETWORK: Network = { volumeUsd: 0, feesUsd: 0, activePools: 0, swaps: 0 };
const EMPTY: PulseData = {
  window: "24h",
  overview: {
    window: "24h",
    volumeUsd: 0,
    feesUsd: 0,
    activePools: 0,
    volumeRatio: 0,
    feesRatio: 0,
    activePoolsDelta: 0,
  },
  network: EMPTY_NETWORK,
  chart: [],
  pools: [],
  updatedAt: null,
};

function toBucket(r: PulseRowDb): Bucket {
  return {
    t: r.bucket_start,
    fees: Number(r.fees_usd),
    volume: Number(r.volume_usd),
    liqNet: Number(r.liquidity_net_usd),
    swaps: r.swap_count,
    traders: r.unique_traders,
    topWallet: r.top_wallet_pct === null ? null : Number(r.top_wallet_pct),
    price: r.price_close === null ? null : Number(r.price_close),
  };
}

async function loadRaw() {
  const db = client();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const [{ data: pools }, { data: pulse }] = await Promise.all([
    db.from("pools").select("id,dex,token0_symbol,token1_symbol,fee_tier,tvl_usd,first_seen").eq("is_active", true),
    db
      .from("pool_pulse_5m")
      .select("pool_id,bucket_start,fees_usd,volume_usd,liquidity_net_usd,swap_count,unique_traders,top_wallet_pct,price_close")
      .gte("bucket_start", since)
      .order("bucket_start", { ascending: true }),
  ]);
  const byPool = new Map<string, Bucket[]>();
  for (const r of (pulse ?? []) as PulseRowDb[]) {
    const arr = byPool.get(r.pool_id) ?? [];
    arr.push(toBucket(r));
    byPool.set(r.pool_id, arr);
  }
  return { pools: (pools ?? []) as PoolDb[], byPool };
}

function summarizePool(pool: PoolDb, buckets: Bucket[], w: Window): PoolRow | null {
  const asc = [...buckets].sort((a, b) => a.t.localeCompare(b.t));
  const nWin = windowBuckets(w);
  const win = asc.slice(-nWin);
  if (win.length === 0) return null;

  const sum = (arr: Bucket[], k: keyof Bucket) =>
    arr.reduce((s, b) => s + (typeof b[k] === "number" ? (b[k] as number) : 0), 0);

  const winFees = sum(win, "fees");
  const winVol = sum(win, "volume");
  const winLiq = sum(win, "liqNet");
  const winSwaps = sum(win, "swaps");

  // velocity: window fees-per-bucket vs the prior hour's average per-bucket
  const prior = asc.slice(-(nWin + 12), -nWin);
  const priorPerBucket =
    prior.length > 0 ? sum(prior, "fees") / prior.length : 0;
  const curPerBucket = winFees / win.length;
  const vel = classifyVelocity(curPerBucket, priorPerBucket);

  // 24h fees for APR (all fetched buckets ≈ last 24h)
  const fees24h = sum(asc, "fees");
  const aprEst = estApr24h(fees24h, pool.tvl_usd);

  // trust: worst-case over the window
  const topWallet = Math.max(
    0,
    ...win.map((b) => (b.topWallet === null ? 0 : b.topWallet)),
  );
  const traders = Math.max(
    0,
    ...win.map((b) => (b.traders === null ? 0 : b.traders)),
  );
  const hasTopWallet = win.some((b) => b.topWallet !== null);
  const hasTraders = win.some((b) => b.traders !== null);
  const ageMin = (Date.now() - new Date(pool.first_seen).getTime()) / 60000;
  const risks = riskFlags({
    tvlUsd: pool.tvl_usd,
    topWalletPct: hasTopWallet ? topWallet : null,
    uniqueTraders: hasTraders ? traders : null,
    poolAgeMinutes: ageMin,
  });

  const latest = win[win.length - 1]!;
  return {
    id: pool.id,
    dex: pool.dex,
    label: `${pool.token0_symbol} / ${pool.token1_symbol}`,
    token0Symbol: pool.token0_symbol,
    token1Symbol: pool.token1_symbol,
    feeTier: pool.fee_tier,
    segment: classifySegment(pool.token0_symbol, pool.token1_symbol),
    feesUsd: winFees,
    volumeUsd: winVol,
    liquidityNetUsd: winLiq,
    swaps: winSwaps,
    velocity: vel.label,
    velocityRatio: vel.ratio,
    aprEst,
    tvlUsd: pool.tvl_usd,
    risks,
    topWalletPct: hasTopWallet ? topWallet : null,
    uniqueTraders: hasTraders ? traders : null,
    ageMinutes: Number.isFinite(ageMin) ? ageMin : null,
    spark: asc.slice(-16).map((b) => b.volume),
    priceClose: latest.price,
  };
}

function buildOverview(pools: PoolRow[], byPool: Map<string, Bucket[]>, w: Window): Overview {
  const volumeUsd = pools.reduce((s, p) => s + p.volumeUsd, 0);
  const feesUsd = pools.reduce((s, p) => s + p.feesUsd, 0);
  const activePools = pools.filter((p) => p.volumeUsd > 0 || p.feesUsd > 0).length;

  // baseline: the window immediately before the current one, chain-wide
  const nWin = windowBuckets(w);
  let priorVol = 0,
    priorFees = 0,
    priorActive = 0;
  for (const buckets of byPool.values()) {
    const asc = [...buckets].sort((a, b) => a.t.localeCompare(b.t));
    const prior = asc.slice(-(nWin * 2), -nWin);
    const v = prior.reduce((s, b) => s + b.volume, 0);
    const f = prior.reduce((s, b) => s + b.fees, 0);
    priorVol += v;
    priorFees += f;
    if (v > 0 || f > 0) priorActive += 1;
  }
  return {
    window: w,
    volumeUsd,
    feesUsd,
    activePools,
    volumeRatio: priorVol > 0 ? volumeUsd / priorVol : 0,
    feesRatio: priorFees > 0 ? feesUsd / priorFees : 0,
    activePoolsDelta: activePools - priorActive,
  };
}

function buildNetwork(byPool: Map<string, Bucket[]>): Network {
  let volumeUsd = 0,
    feesUsd = 0,
    swaps = 0,
    activePools = 0;
  for (const buckets of byPool.values()) {
    let v = 0,
      f = 0,
      s = 0;
    for (const b of buckets) {
      v += b.volume;
      f += b.fees;
      s += b.swaps;
    }
    volumeUsd += v;
    feesUsd += f;
    swaps += s;
    if (v > 0 || f > 0) activePools += 1;
  }
  return { volumeUsd, feesUsd, swaps, activePools };
}

function buildChart(byPool: Map<string, Bucket[]>): ChartPoint[] {
  // union of the last CHART_BUCKETS bucket timestamps, chain-wide
  const perBucket = new Map<string, ChartPoint>();
  for (const buckets of byPool.values()) {
    for (const b of buckets) {
      let cp = perBucket.get(b.t);
      if (!cp) {
        cp = { bucketStart: b.t, volumeUsd: 0, feesUsd: 0, liquidityNetUsd: 0, activePools: 0 };
        perBucket.set(b.t, cp);
      }
      cp.volumeUsd += b.volume;
      cp.feesUsd += b.fees;
      cp.liquidityNetUsd += b.liqNet;
      if (b.volume > 0 || b.fees > 0) cp.activePools += 1;
    }
  }
  return [...perBucket.values()]
    .sort((a, b) => a.bucketStart.localeCompare(b.bucketStart))
    .slice(-CHART_BUCKETS);
}

export async function getPulse(w: Window): Promise<PulseData> {
  if (!HAS_SUPABASE) return { ...EMPTY, window: w, overview: { ...EMPTY.overview, window: w } };
  const { pools, byPool } = await loadRaw();
  const rows = pools
    .map((p) => summarizePool(p, byPool.get(p.id) ?? [], w))
    .filter((r): r is PoolRow => r !== null && (r.volumeUsd > 0 || r.feesUsd > 0))
    .sort((a, b) => b.feesUsd - a.feesUsd);
  const chart = buildChart(byPool);
  const updatedAt = chart.length > 0 ? chart[chart.length - 1]!.bucketStart : null;
  return {
    window: w,
    overview: buildOverview(rows, byPool, w),
    network: buildNetwork(byPool),
    chart,
    pools: rows,
    updatedAt,
  };
}

// --- pool detail (used by /pool/[id]) --------------------------------------
export async function getPoolDetail(id: string): Promise<PoolDetail | null> {
  if (!HAS_SUPABASE) return null;
  const { pools, byPool } = await loadRaw();
  const pool = pools.find((p) => p.id === id);
  if (!pool) return null;
  const buckets = (byPool.get(id) ?? []).sort((a, b) => a.t.localeCompare(b.t));
  const summary = summarizePool(pool, buckets, "24h");
  if (!summary) return null;

  const series: PulseWindow[] = buckets.slice(-24).map((b) => ({
    bucketStart: b.t,
    feesUsd: b.fees,
    volumeUsd: b.volume,
    liquidityNetUsd: b.liqNet,
    swapCount: b.swaps,
    priceClose: b.price,
  }));
  const last = (n: number) => buckets.slice(-n).reduce((s, b) => s + b.fees, 0);
  const feeHorizons: FeeHorizons = {
    m5: last(1),
    m30: last(6),
    h1: last(12),
    h6: last(72),
    h24: last(288),
  };
  return { summary, series, feeHorizons };
}

// --- price ticker (top marquee) --------------------------------------------
const USD_QUOTES = new Set(["USDG", "USDB", "USDC", "USDT", "DAI", "USD", "FRAX", "GHO", "USDE", "PYUSD"]);

export async function getTicker(): Promise<TickerItem[]> {
  if (!HAS_SUPABASE) return [];
  const db = client();
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const [{ data: pools }, { data: pulse }] = await Promise.all([
    db.from("pools").select("id,token0_symbol,token1_symbol").eq("is_active", true),
    db
      .from("pool_pulse_5m")
      .select("pool_id,price_close,bucket_start")
      .gte("bucket_start", since)
      .order("bucket_start", { ascending: true }),
  ]);
  const latest = new Map<string, number>();
  for (const r of (pulse ?? []) as { pool_id: string; price_close: number | null }[]) {
    if (r.price_close !== null && r.price_close !== undefined) latest.set(r.pool_id, Number(r.price_close));
  }
  // Only pools with exactly ONE USD-stable side give a meaningful USD price.
  // Show the non-stable token, oriented (invert when the stable is token0), and
  // dedupe by symbol so a token appears once.
  const bySym = new Map<string, TickerItem>();
  for (const p of (pools ?? []) as { id: string; token0_symbol: string; token1_symbol: string }[]) {
    const price = latest.get(p.id);
    if (price === undefined || !(price > 0)) continue;
    const s0 = USD_QUOTES.has(String(p.token0_symbol).toUpperCase());
    const s1 = USD_QUOTES.has(String(p.token1_symbol).toUpperCase());
    if (s0 === s1) continue; // need exactly one stable side
    let sym: string;
    let usdPrice: number;
    if (s1) { sym = p.token0_symbol; usdPrice = price; } // token0 priced in USD
    else { sym = p.token1_symbol; usdPrice = 1 / price; } // token1 is non-stable → invert
    if (!(usdPrice > 0) || usdPrice > 1e7 || usdPrice < 1e-9) continue;
    const key = sym.toUpperCase();
    if (bySym.has(key)) continue;
    bySym.set(key, { sym, quote: "USD", price: usdPrice, usd: true });
  }
  return [...bySym.values()].slice(0, 30);
}

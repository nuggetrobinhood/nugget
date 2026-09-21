import type { IngestAdapter, PoolEvent, PoolMeta, Dex } from "../../lib/types";

/**
 * Deterministic-ish mock adapter. Generates plausible pool events so the whole
 * pipeline (bucket -> velocity -> upsert) can be proven locally with zero
 * network access and no API keys. It mimics the shape Bitquery returns.
 *
 * It fabricates an "accelerating" pool and a "cooling" pool so the velocity
 * classifier has something meaningful to label.
 */

const POOLS: PoolMeta[] = [
  {
    id: "0xweth_usdg_v3_500",
    dex: "uniswap-v3",
    token0Symbol: "WETH",
    token1Symbol: "USDG",
    feeTier: 500,
    tvlUsd: 6_200_000,
  },
  {
    id: "0xeth_usdg_v4_500",
    dex: "uniswap-v4",
    token0Symbol: "ETH",
    token1Symbol: "USDG",
    feeTier: 500,
    tvlUsd: 4_100_000,
  },
  {
    id: "0xnvda_usdg_v3_3000",
    dex: "uniswap-v3",
    token0Symbol: "NVDA",
    token1Symbol: "USDG",
    feeTier: 3000,
    tvlUsd: 820_000,
  },
];

// pseudo-random but seeded so runs are reproducible in tests
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function eventsForPool(
  pool: PoolMeta,
  fromTs: number,
  toTs: number,
): PoolEvent[] {
  const out: PoolEvent[] = [];
  const rand = rng(hash(pool.id) ^ fromTs);
  const basePrice =
    pool.token0Symbol === "NVDA" ? 218 : pool.token0Symbol.includes("ETH") ? 2470 : 1;

  // activity profile: WETH pool = accelerating, NVDA = cooling
  const accel = pool.token0Symbol.includes("ETH") ? 1 : 0.4;

  let t = fromTs;
  while (t < toTs) {
    // more events later in the window for the "accelerating" pool
    const progress = (t - fromTs) / Math.max(1, toTs - fromTs);
    const intensity = accel * (0.5 + progress);
    const gap = Math.max(3, Math.floor(20 / intensity - rand() * 10));
    t += gap;
    if (t >= toTs) break;

    const roll = rand();
    const price = basePrice * (1 + (rand() - 0.5) * 0.01);

    if (roll < 0.82) {
      // swap
      const vol = 500 + rand() * 8000 * intensity;
      const feeBps = (pool.feeTier ?? 3000) / 1_000_000; // 500 -> 0.0005
      // NVDA pool has fewer, more concentrated traders (to exercise trust signals)
      const traderPool = pool.token0Symbol === "NVDA" ? 4 : 60;
      out.push({
        poolId: pool.id,
        dex: pool.dex,
        kind: "swap",
        timestamp: t,
        amountUsd: vol,
        feeUsd: vol * feeBps,
        priceToken0InToken1: price,
        trader: `0xtr${Math.floor(rand() * traderPool)}`,
      });
    } else if (roll < 0.92) {
      // mint (add liquidity)
      out.push({
        poolId: pool.id,
        dex: pool.dex,
        kind: "mint",
        timestamp: t,
        amountUsd: 2000 + rand() * 40000,
        feeUsd: 0,
        priceToken0InToken1: price,
        lpAddress: `0xlp${Math.floor(rand() * 200)}`,
      });
    } else {
      // burn (remove liquidity)
      out.push({
        poolId: pool.id,
        dex: pool.dex,
        kind: "burn",
        timestamp: t,
        amountUsd: 1000 + rand() * 20000,
        feeUsd: 0,
        priceToken0InToken1: price,
        lpAddress: `0xlp${Math.floor(rand() * 200)}`,
      });
    }
  }
  return out;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export class MockAdapter implements IngestAdapter {
  readonly name = "mock";

  async listTopPools(limit: number): Promise<PoolMeta[]> {
    return POOLS.slice(0, limit);
  }

  async fetchEvents(
    poolIds: string[],
    fromTs: number,
    toTs: number,
  ): Promise<PoolEvent[]> {
    const set = new Set(poolIds);
    const pools = POOLS.filter((p) => set.has(p.id));
    return pools.flatMap((p) => eventsForPool(p, fromTs, toTs));
  }
}

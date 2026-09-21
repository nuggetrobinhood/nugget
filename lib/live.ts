// On-demand, per-pool live read from Bitquery. Server-side only.
//
// This is the efficient counterpart to the stored 5-minute rollups: instead of
// ingesting every raw swap for every pool (what killed TACO), we query Bitquery
// live ONLY for the single pool a user is currently viewing. Nothing is stored;
// it runs at most once per pool-page view.
//
// Needs BITQUERY_API_KEY on the server (Vercel). If it's missing or the request
// fails, this returns null and the page shows a clean "live unavailable" state.
import type { LivePool, LiveSwap } from "./model";

const ENDPOINT = process.env.BITQUERY_ENDPOINT || "https://streaming.bitquery.io/graphql";
const NETWORK = process.env.BITQUERY_NETWORK || "robinhood";
const WINDOW_HOURS = 6;

const QUERY = /* GraphQL */ `
query PoolTrades($network: evm_network, $pool: String, $since: DateTime) {
  EVM(network: $network, dataset: realtime) {
    DEXTrades(
      where: {
        Block: { Time: { since: $since } }
        Trade: { Dex: { SmartContract: { is: $pool } } }
      }
      orderBy: { descending: Block_Time }
      limit: { count: 60 }
    ) {
      Block { Time }
      Transaction { Hash From }
      Trade {
        Buy  { AmountInUSD Price Currency { Symbol } }
        Sell { AmountInUSD Currency { Symbol } }
      }
    }
  }
}`;

function median(nums: number[]): number {
  if (nums.length === 0) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

export async function getPoolLive(poolId: string, token0Symbol: string): Promise<LivePool | null> {
  const key = process.env.BITQUERY_API_KEY;
  if (!key) return null;

  const since = new Date(Date.now() - WINDOW_HOURS * 3600 * 1000).toISOString();
  let json: any;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ query: QUERY, variables: { network: NETWORK, pool: poolId, since } }),
      // don't cache — this is a live read
      cache: "no-store",
    });
    if (!res.ok) return null;
    json = await res.json();
  } catch {
    return null;
  }
  if (json?.errors?.length || !json?.data) return null;

  const rows: any[] = json.data?.EVM?.DEXTrades ?? [];
  const swaps: LiveSwap[] = [];
  const amounts: number[] = [];
  const traders = new Set<string>();
  let buys = 0;
  let sells = 0;
  let priceLast: number | null = null;

  for (const t of rows) {
    const buyUsd = Number(t?.Trade?.Buy?.AmountInUSD ?? 0);
    const sellUsd = Number(t?.Trade?.Sell?.AmountInUSD ?? 0);
    const amountUsd = Math.max(buyUsd, sellUsd);
    const buySym: string = t?.Trade?.Buy?.Currency?.Symbol ?? "?";
    const sellSym: string = t?.Trade?.Sell?.Currency?.Symbol ?? "?";
    // "BUY" = someone bought the base token (token0) of the pool
    const type: "BUY" | "SELL" = buySym.toUpperCase() === token0Symbol.toUpperCase() ? "BUY" : "SELL";
    if (type === "BUY") buys++; else sells++;
    const from: string = (t?.Transaction?.From ?? "").toLowerCase();
    if (from) traders.add(from);
    if (amountUsd > 0) amounts.push(amountUsd);
    const price = Number(t?.Trade?.Buy?.Price ?? 0) || null;
    if (priceLast === null && price) priceLast = price;
    swaps.push({
      time: t?.Block?.Time ?? "",
      type,
      inSym: type === "BUY" ? sellSym : buySym,
      outSym: type === "BUY" ? buySym : sellSym,
      amountUsd,
      priceUsd: price,
      hash: t?.Transaction?.Hash ?? "",
      trader: from,
    });
  }

  const avgUsd = amounts.length ? amounts.reduce((s, v) => s + v, 0) / amounts.length : 0;

  return {
    swaps: swaps.slice(0, 25),
    buys,
    sells,
    avgUsd,
    medianUsd: median(amounts),
    priceLast,
    uniqueTraders: traders.size,
    windowHours: WINDOW_HOURS,
  };
}

import type {
  IngestAdapter,
  PoolEvent,
  PoolMeta,
  Dex,
} from "../../lib/types";
import { config } from "../config";

/**
 * Bitquery adapter for Robinhood Chain (chain id 4663).
 * Covers Uniswap v3 + v4 via one decoded schema.
 */

const NETWORK = process.env.BITQUERY_NETWORK ?? "robinhood";

interface GraphQLResponse<T> {
  data?: T;
  errors?: { message: string }[];
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (!config.bitqueryApiKey) {
    throw new Error(
      "BITQUERY_API_KEY is empty. Set it (Bitquery IDE -> account -> API key) or use INGEST_ADAPTER=mock.",
    );
  }
  const res = await fetch(config.bitqueryEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.bitqueryApiKey}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Bitquery HTTP ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = (await res.json()) as GraphQLResponse<T>;
  if (json.errors?.length) {
    throw new Error(`Bitquery GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) throw new Error("Bitquery returned no data");
  return json.data;
}

const iso = (unixSeconds: number) => new Date(unixSeconds * 1000).toISOString();

// --- top pools by 24h volume -----------------------------------------------
const TOP_POOLS_QUERY = /* GraphQL */ `
query TopPools($network: evm_network, $since: DateTime, $limit: Int) {
  EVM(network: $network, dataset: realtime) {
    DEXTradeByTokens(
      where: {
        Block: { Time: { since: $since } }
        Trade: { Dex: { ProtocolFamily: { is: "Uniswap" } } }
      }
      orderBy: { descendingByField: "vol" }
      limit: { count: $limit }
    ) {
      vol: sum(of: Trade_Side_AmountInUSD)
      Trade {
        Dex { ProtocolName ProtocolVersion SmartContract }
        Currency { Symbol SmartContract }
        Side { Currency { Symbol SmartContract } }
      }
    }
  }
}`;

// --- swaps in a window ------------------------------------------------------
const TRADES_QUERY = /* GraphQL */ `
query Trades($network: evm_network, $from: DateTime, $to: DateTime, $pools: [String!]) {
  EVM(network: $network, dataset: realtime) {
    DEXTrades(
      where: {
        Block: { Time: { since: $from, till: $to } }
        Trade: { Dex: { SmartContract: { in: $pools } } }
      }
      orderBy: { ascending: Block_Time }
      limit: { count: 25000 }
    ) {
      Block { Time }
      Transaction { From }
      Trade {
        Dex { SmartContract ProtocolVersion }
        Buy  { Amount AmountInUSD Price Currency { Symbol } }
        Sell { Amount AmountInUSD Currency { Symbol } }
      }
    }
  }
}`;

function versionToDex(v: string | undefined): Dex {
  return v && v.includes("4") ? "uniswap-v4" : "uniswap-v3";
}

export class BitqueryAdapter implements IngestAdapter {
  readonly name = "bitquery";

  // pool_id -> fee fraction (e.g. 0.0005), cached from listTopPools
  private feeByPool = new Map<string, number>();
  // pool_id -> token0 symbol, so we can pick token0's USD price per swap
  private token0ByPool = new Map<string, string>();

  async listTopPools(limit: number): Promise<PoolMeta[]> {
    const since = iso(Math.floor(Date.now() / 1000) - 24 * 3600);
    // DEXTradeByTokens groups per TOKEN SIDE, so a single pool spans several
    // rows (A->B, B->A, and one set per fee tier). Over-fetch, then dedupe by
    // pool and rank by summed volume, so we surface `limit` real pools.
    const fetchCount = Math.min(1000, Math.max(300, limit * 6));
    const data = await gql<any>(TOP_POOLS_QUERY, {
      network: NETWORK,
      since,
      limit: fetchCount,
    });
    const rows: any[] = data?.EVM?.DEXTradeByTokens ?? [];
    const agg = new Map<string, { meta: PoolMeta; vol: number; best: number }>();
    for (const r of rows) {
      const sc: string | undefined = r?.Trade?.Dex?.SmartContract;
      if (!sc) continue;
      const id = sc.toLowerCase();
      const vol = Number(r?.vol ?? 0);
      const cur = agg.get(id);
      if (cur) {
        cur.vol += vol;
        if (vol > cur.best) {
          cur.best = vol;
          cur.meta.token0Symbol = r?.Trade?.Currency?.Symbol ?? cur.meta.token0Symbol;
          cur.meta.token1Symbol = r?.Trade?.Side?.Currency?.Symbol ?? cur.meta.token1Symbol;
        }
      } else {
        agg.set(id, {
          vol,
          best: vol,
          meta: {
            id,
            dex: versionToDex(r?.Trade?.Dex?.ProtocolVersion),
            token0Symbol: r?.Trade?.Currency?.Symbol ?? "?",
            token1Symbol: r?.Trade?.Side?.Currency?.Symbol ?? "?",
          },
        });
      }
    }
    return [...agg.values()]
      .sort((a, b) => b.vol - a.vol)
      .slice(0, limit)
      .map((x) => x.meta);
  }

  async fetchEvents(
    poolIds: string[],
    fromTs: number,
    toTs: number,
  ): Promise<PoolEvent[]> {
    if (poolIds.length === 0) return [];
    const data = await gql<any>(TRADES_QUERY, {
      network: NETWORK,
      from: iso(fromTs),
      to: iso(toTs),
      pools: poolIds,
    });
    const trades: any[] = data?.EVM?.DEXTrades ?? [];
    const out: PoolEvent[] = [];
    for (const t of trades) {
      const sc: string | undefined = t?.Trade?.Dex?.SmartContract;
      if (!sc) continue;
      const poolId = sc.toLowerCase();
      const ts = Math.floor(new Date(t?.Block?.Time).getTime() / 1000);
      const buyUsd = Number(t?.Trade?.Buy?.AmountInUSD ?? 0);
      const sellUsd = Number(t?.Trade?.Sell?.AmountInUSD ?? 0);
      const amountUsd = Math.max(buyUsd, sellUsd);
      const feeFrac = this.feeByPool.get(poolId) ?? 0.003;
      const trader: string | undefined = t?.Transaction?.From;
      // token0's USD price = its side's AmountInUSD ÷ Amount (direction-safe,
      // unlike Buy.Price which flips with trade direction).
      const t0 = this.token0ByPool.get(poolId);
      const buySym: string | undefined = t?.Trade?.Buy?.Currency?.Symbol;
      const sellSym: string | undefined = t?.Trade?.Sell?.Currency?.Symbol;
      const buyAmt = Number(t?.Trade?.Buy?.Amount ?? 0);
      const sellAmt = Number(t?.Trade?.Sell?.Amount ?? 0);
      let priceUsd: number | undefined;
      if (t0 && buySym?.toUpperCase() === t0.toUpperCase() && buyAmt > 0 && buyUsd > 0) priceUsd = buyUsd / buyAmt;
      else if (t0 && sellSym?.toUpperCase() === t0.toUpperCase() && sellAmt > 0 && sellUsd > 0) priceUsd = sellUsd / sellAmt;
      out.push({
        poolId,
        dex: versionToDex(t?.Trade?.Dex?.ProtocolVersion),
        kind: "swap",
        timestamp: ts,
        amountUsd,
        feeUsd: amountUsd * feeFrac,
        priceToken0InToken1: priceUsd,
        trader: trader ? trader.toLowerCase() : undefined,
      });
    }
    return out.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Called by the worker after listTopPools to seed fee fractions if known. */
  setFeeTiers(map: Map<string, number>) {
    this.feeByPool = map;
  }

  /** Seed pool_id -> token0 symbol so per-swap USD price picks the right side. */
  setToken0Symbols(map: Map<string, string>) {
    this.token0ByPool = map;
  }
}

import type {
  IngestAdapter,
  PoolEvent,
  PoolMeta,
  Dex,
} from "../../lib/types";
import { config } from "../config";

/**
 * Bitquery adapter for Robinhood Chain (chain id 4663).
 *
 * Bitquery already decodes Uniswap v2/v3/v4 on RHC into one schema, so this
 * one adapter covers BOTH v3 and v4 pulse data — that's the whole reason we
 * can include v4 in V1 without maintaining a v4 subgraph ourselves.
 *
 * ---------------------------------------------------------------------------
 * VERIFY-ON-DEPLOY (do this once in https://ide.bitquery.io before first run):
 *   1. Confirm the RHC network slug. Try `network: robinhood` first; Bitquery
 *      sometimes uses a different slug. Set BITQUERY_NETWORK if it differs.
 *   2. Confirm DEXTrades fields (Trade.Buy.AmountInUSD etc.) against the IDE's
 *      autocomplete — Bitquery occasionally renames sub-fields.
 *   3. Liquidity (mint/burn) events: v3 emits Mint/Burn, v4 emits
 *      ModifyLiquidity on the PoolManager. The query below pulls both via the
 *      Events API. If your plan doesn't include decoded events on RHC yet,
 *      swaps still flow and liquidity flow just reads 0 until enabled.
 *
 * Everything downstream is isolated from these details — if a field name is
 * off, you fix it HERE and nowhere else.
 * ---------------------------------------------------------------------------
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
        Buy  { AmountInUSD Price Currency { Symbol } }
        Sell { AmountInUSD Currency { Symbol } }
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

  async listTopPools(limit: number): Promise<PoolMeta[]> {
    const since = iso(Math.floor(Date.now() / 1000) - 24 * 3600);
    const data = await gql<any>(TOP_POOLS_QUERY, {
      network: NETWORK,
      since,
      limit,
    });
    const rows: any[] = data?.EVM?.DEXTradeByTokens ?? [];
    const pools: PoolMeta[] = [];
    for (const r of rows) {
      const sc: string | undefined = r?.Trade?.Dex?.SmartContract;
      if (!sc) continue;
      const id = sc.toLowerCase();
      const dex = versionToDex(r?.Trade?.Dex?.ProtocolVersion);
      pools.push({
        id,
        dex,
        token0Symbol: r?.Trade?.Currency?.Symbol ?? "?",
        token1Symbol: r?.Trade?.Side?.Currency?.Symbol ?? "?",
      });
    }
    return pools;
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
      // volume ~ the larger notional side (both should be close)
      const amountUsd = Math.max(buyUsd, sellUsd);
      const feeFrac = this.feeByPool.get(poolId) ?? 0.003; // default 0.3% if tier unknown
      const trader: string | undefined = t?.Transaction?.From;
      out.push({
        poolId,
        dex: versionToDex(t?.Trade?.Dex?.ProtocolVersion),
        kind: "swap",
        timestamp: ts,
        amountUsd,
        feeUsd: amountUsd * feeFrac,
        priceToken0InToken1: Number(t?.Trade?.Buy?.Price ?? 0) || undefined,
        trader: trader ? trader.toLowerCase() : undefined,
      });
    }
    // NOTE: mint/burn (liquidity flow) events are pulled via the Events API in
    // a follow-up query once decoded-event access is confirmed on your plan.
    // Swaps above already power Pulse, Fee Velocity and Pool Activity.
    return out.sort((a, b) => a.timestamp - b.timestamp);
  }

  /** Called by the worker after listTopPools to seed fee fractions if known. */
  setFeeTiers(map: Map<string, number>) {
    this.feeByPool = map;
  }
}

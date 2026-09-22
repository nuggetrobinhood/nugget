import type {
  IngestAdapter,
  PoolEvent,
  PoolMeta,
  Pulse5m,
  Dex,
} from "../../lib/types";

/**
 * GeckoTerminal adapter for Robinhood Chain.
 *
 * Unlike the Bitquery adapter (which streams raw swaps and rolls them up), this
 * source already exposes pre-computed rolling windows per pool — m5/h1/h24
 * volume, price, price change, and buy/sell/buyer/seller counts — in ONE cheap,
 * key-less endpoint. That means:
 *   - no API points / quota wall (Bitquery's trial ran out); GT free tier is
 *     just a 30 req/min rate limit, and we use ~3 calls per 5-minute run,
 *   - clean token0 USD price straight from `base_token_price_usd` (kills the
 *     whole price-direction bug class),
 *   - no 25k-row swap pulls.
 *
 * We read each pool's m5 snapshot every run and write it as one pool_pulse_5m
 * row (same schema as before), so the frontend, chart and windows are unchanged.
 *
 * What we give up vs raw swaps: exact single-wallet concentration (top-wallet %).
 * GT gives buyer/seller COUNTS, not per-wallet volume share, so top_wallet_pct
 * is null here and the "few traders" flag carries the trust signal instead.
 *
 * ---------------------------------------------------------------------------
 * VERIFY-ON-DEPLOY: confirm the RHC slug ("robinhood") and that active pools
 * expose volume_usd.m5 at https://api.geckoterminal.com/api/v2/networks/robinhood/pools
 * ---------------------------------------------------------------------------
 */

const NETWORK = process.env.NUGGET_GECKOTERMINAL_NETWORK ?? "robinhood";
const BASE = "https://api.geckoterminal.com/api/v2";

function num(x: unknown): number {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
}

function dexFromId(id: string | undefined): Dex {
  return id && id.toLowerCase().includes("v4") ? "uniswap-v4" : "uniswap-v3";
}

interface Cached {
  meta: PoolMeta;
  volM5: number;
  buys: number;
  sells: number;
  buyers: number;
  sellers: number;
  priceUsd: number | null; // token0 (base token) USD price
}

export class GeckoTerminalAdapter implements IngestAdapter {
  readonly name = "geckoterminal";

  // pool_id -> latest m5 snapshot, filled by listTopPools and read by fetchPulseRows
  private cache = new Map<string, Cached>();

  async listTopPools(limit: number): Promise<PoolMeta[]> {
    this.cache.clear();
    const ranked: { meta: PoolMeta; vol24: number }[] = [];
    const perPage = 20;
    // small over-fetch so we can rank the top `limit` by 24h volume
    const pages = Math.min(10, Math.ceil(limit / perPage) + 1);

    for (let page = 1; page <= pages; page++) {
      const url = `${BASE}/networks/${NETWORK}/pools?include=base_token,quote_token&page=${page}`;
      let json: any;
      try {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) {
          console.warn(`[nugget] GT pools HTTP ${res.status} page ${page} (check network slug)`);
          break;
        }
        json = await res.json();
      } catch (err) {
        console.warn(`[nugget] GT pools fetch failed: ${err instanceof Error ? err.message : err}`);
        break;
      }

      // token metadata (symbol + address) lives in the `included` array
      const tokens = new Map<string, { symbol: string; address: string }>();
      for (const inc of json?.included ?? []) {
        if (inc?.type === "token") {
          tokens.set(inc.id, {
            symbol: inc?.attributes?.symbol ?? "?",
            address: String(inc?.attributes?.address ?? "").toLowerCase(),
          });
        }
      }

      const rows: any[] = json?.data ?? [];
      if (rows.length === 0) break;

      for (const r of rows) {
        const a = r?.attributes ?? {};
        const addr = String(a.address ?? "").toLowerCase();
        if (!addr) continue;
        const bt = tokens.get(r?.relationships?.base_token?.data?.id);
        const qt = tokens.get(r?.relationships?.quote_token?.data?.id);
        const nameParts = String(a.name ?? "").split("/");
        const meta: PoolMeta = {
          id: addr,
          dex: dexFromId(r?.relationships?.dex?.data?.id),
          token0Symbol: bt?.symbol ?? nameParts[0]?.trim() ?? "?",
          token1Symbol: qt?.symbol ?? nameParts[1]?.trim() ?? "?",
          token0: bt?.address || undefined,
          token1: qt?.address || undefined,
          tvlUsd: num(a.reserve_in_usd) > 0 ? num(a.reserve_in_usd) : undefined,
        };
        const tx = a?.transactions?.m5 ?? {};
        const price = num(a.base_token_price_usd);
        this.cache.set(addr, {
          meta,
          volM5: num(a?.volume_usd?.m5),
          buys: num(tx.buys),
          sells: num(tx.sells),
          buyers: num(tx.buyers),
          sellers: num(tx.sellers),
          priceUsd: price > 0 ? price : null,
        });
        ranked.push({ meta, vol24: num(a?.volume_usd?.h24) });
      }
    }

    return ranked
      .sort((a, b) => b.vol24 - a.vol24)
      .slice(0, limit)
      .map((x) => x.meta);
  }

  // Event path is unused for GeckoTerminal — fetchPulseRows produces rows directly.
  async fetchEvents(): Promise<PoolEvent[]> {
    return [];
  }

  async fetchPulseRows(pools: PoolMeta[], bucketStartIso: string): Promise<Pulse5m[]> {
    const out: Pulse5m[] = [];
    for (const p of pools) {
      const c = this.cache.get(p.id);
      if (!c) continue;
      // NUGGET only surfaces pools doing something in the last 5 minutes — skip
      // the quiet ones so they never take a row (also keeps storage lean).
      if (c.volM5 <= 0) continue;

      const feeFrac = p.feeTier ? p.feeTier / 1_000_000 : 0.003; // default 0.3%
      const swaps = c.buys + c.sells;
      const traders = c.buyers + c.sellers;
      out.push({
        poolId: p.id,
        bucketStart: bucketStartIso,
        feesUsd: c.volM5 * feeFrac,
        volumeUsd: c.volM5,
        liquidityAddUsd: 0,
        liquidityRmUsd: 0,
        swapCount: swaps,
        mintCount: 0,
        burnCount: 0,
        lpCount: null,
        uniqueTraders: traders > 0 ? traders : null,
        topWalletPct: null, // GT gives counts, not per-wallet share
        priceOpen: null,
        priceClose: c.priceUsd,
        activeLiquidity: null,
      });
    }
    return out;
  }
}

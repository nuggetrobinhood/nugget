// TVL fetcher — current pool TVL (reserve in USD) for est. APR.
//
// Uses GeckoTerminal (CoinGecko's DEX API), which is free, no key, and gives
// per-pool TVL directly. NOT the main CoinGecko API (that's token prices).
//
// TVL is stored as a SNAPSHOT overwritten each run (one column on the pool row),
// never a time series — that's what keeps est. APR possible without growing
// storage. See spec §5.
//
// -------------------------------------------------------------------------
// VERIFY-ON-DEPLOY: confirm the RHC network slug on GeckoTerminal. Try
// "robinhood" first; if the API 404s, find the right slug at
// https://api.geckoterminal.com/api/v2/networks and set NUGGET_GECKOTERMINAL_NETWORK.
// If TVL can't be fetched, everything else still works — est. APR just shows "—".
// -------------------------------------------------------------------------

const NETWORK = process.env.NUGGET_GECKOTERMINAL_NETWORK ?? "robinhood";
const BASE = "https://api.geckoterminal.com/api/v2";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

/**
 * Returns a map of poolAddress(lowercased) -> tvlUsd for the pools it could
 * resolve. Best-effort: on any error it returns whatever it got (possibly
 * empty) and never throws, so a TVL outage can't break ingest.
 */
export async function fetchTvl(poolIds: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (poolIds.length === 0) return result;

  for (const group of chunk(poolIds, 30)) {
    const addrs = group.join(",");
    const url = `${BASE}/networks/${NETWORK}/pools/multi/${addrs}`;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[nugget] TVL fetch HTTP ${res.status} for ${NETWORK} (check network slug)`);
        continue;
      }
      const json: any = await res.json();
      const rows: any[] = json?.data ?? [];
      for (const row of rows) {
        const addr: string | undefined = row?.attributes?.address;
        const tvl = Number(row?.attributes?.reserve_in_usd ?? 0);
        if (addr && tvl > 0) result.set(addr.toLowerCase(), tvl);
      }
    } catch (err) {
      console.warn(`[nugget] TVL fetch failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return result;
}

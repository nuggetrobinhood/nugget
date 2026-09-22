import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config";
import type { PoolMeta, Pulse5m } from "../lib/types";

// Server-side client using the service role key. Bypasses RLS. Never ship this
// key to the browser.
export function serverClient(): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function upsertPools(db: SupabaseClient, pools: PoolMeta[]) {
  if (pools.length === 0) return;
  const rows = pools.map((p) => ({
    id: p.id,
    dex: p.dex,
    token0_symbol: p.token0Symbol,
    token1_symbol: p.token1Symbol,
    token0: p.token0 ?? null,
    token1: p.token1 ?? null,
    fee_tier: p.feeTier ?? null,
    is_active: true,
    ...(p.tvlUsd !== undefined
      ? { tvl_usd: p.tvlUsd, tvl_at: new Date().toISOString() }
      : {}),
    last_seen: new Date().toISOString(),
  }));
  const { error } = await db.from("pools").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(`upsertPools failed: ${error.message}`);
}

export async function upsertPulse(db: SupabaseClient, rows: Pulse5m[]) {
  if (rows.length === 0) return;
  const mapped = rows.map((r) => ({
    pool_id: r.poolId,
    bucket_start: r.bucketStart,
    fees_usd: r.feesUsd,
    volume_usd: r.volumeUsd,
    liquidity_add_usd: r.liquidityAddUsd,
    liquidity_rm_usd: r.liquidityRmUsd,
    swap_count: r.swapCount,
    mint_count: r.mintCount,
    burn_count: r.burnCount,
    lp_count: r.lpCount,
    unique_traders: r.uniqueTraders,
    top_wallet_pct: r.topWalletPct,
    price_open: r.priceOpen,
    price_close: r.priceClose,
    active_liquidity: r.activeLiquidity,
    updated_at: new Date().toISOString(),
  }));
  // Upsert makes the whole run idempotent: re-ingesting the same window just
  // overwrites the same (pool_id, bucket_start) rows.
  const { error } = await db
    .from("pool_pulse_5m")
    .upsert(mapped, { onConflict: "pool_id,bucket_start" });
  if (error) throw new Error(`upsertPulse failed: ${error.message}`);
}

/**
 * Retention: delete pulse rows older than the cutoff. NUGGET only ever reads a
 * short recent window, so old buckets are dead weight — pruning keeps the DB
 * tiny and well under Supabase's free-tier size cap (this is the storage-growth
 * failure that killed TACO). Best-effort: a prune failure never breaks ingest.
 */
export async function prunePulse(db: SupabaseClient, olderThanIso: string) {
  const { error } = await db
    .from("pool_pulse_5m")
    .delete()
    .lt("bucket_start", olderThanIso);
  if (error) console.warn(`[nugget] prunePulse failed (non-fatal): ${error.message}`);
}

export async function readCursor(
  db: SupabaseClient,
  source: string,
): Promise<number | null> {
  const { data, error } = await db
    .from("ingest_cursor")
    .select("last_bucket")
    .eq("source", source)
    .maybeSingle();
  if (error) throw new Error(`readCursor failed: ${error.message}`);
  if (!data?.last_bucket) return null;
  return Math.floor(new Date(data.last_bucket).getTime() / 1000);
}

export async function writeCursor(
  db: SupabaseClient,
  source: string,
  lastBucketUnix: number,
  note?: string,
) {
  const { error } = await db.from("ingest_cursor").upsert(
    {
      source,
      last_bucket: new Date(lastBucketUnix * 1000).toISOString(),
      last_run_at: new Date().toISOString(),
      note: note ?? null,
    },
    { onConflict: "source" },
  );
  if (error) throw new Error(`writeCursor failed: ${error.message}`);
}

/**
 * NUGGET ingest worker — the entrypoint GitHub Actions calls every 5 minutes.
 *
 * Flow:
 *   1. refresh the tracked-pool registry (top-N by 24h volume)
 *   2. figure out the window to ingest, resuming from the saved cursor
 *      (gap-safe: a missed cron run just makes the next window wider)
 *   3. fetch normalized events, roll them into 5m buckets, upsert
 *   4. advance the cursor to the last COMPLETED bucket only
 *
 * Idempotent: re-running the same window overwrites the same rows.
 */
import { config } from "./config";
import { makeAdapter } from "./adapters/index";
import { BitqueryAdapter } from "./adapters/bitquery";
import { rollupEvents, bucketStart } from "../lib/pulse";
import { fetchTvl } from "./tvl";
import {
  serverClient,
  upsertPools,
  upsertPulse,
  readCursor,
  writeCursor,
} from "./supabase";

async function main() {
  const started = Date.now();
  const bucket = config.bucketSeconds;
  const db = serverClient();
  const adapter = makeAdapter();
  console.log(`[nugget] ingest start — adapter=${adapter.name} bucket=${bucket}s`);

  // 1. tracked pools
  const pools = await adapter.listTopPools(config.trackedPools);
  const poolIds = pools.map((p) => p.id);

  // TVL snapshot (best-effort). Attach to pool metas before upsert so est. APR
  // has fresh TVL. If TVL can't be fetched, pools still upsert without it.
  if (config.enableTvl) {
    const tvl = await fetchTvl(poolIds);
    for (const p of pools) {
      const v = tvl.get(p.id);
      if (v !== undefined) p.tvlUsd = v;
    }
    console.log(`[nugget] TVL resolved for ${tvl.size}/${poolIds.length} pools`);
  }

  await upsertPools(db, pools);
  console.log(`[nugget] tracking ${poolIds.length} pools`);

  // seed fee tiers into the Bitquery adapter so fee estimates are accurate
  if (adapter instanceof BitqueryAdapter) {
    const feeMap = new Map<string, number>();
    for (const p of pools) {
      if (p.feeTier) feeMap.set(p.id, p.feeTier / 1_000_000);
    }
    adapter.setFeeTiers(feeMap);
  }

  // 2. window
  const nowTs = Math.floor(Date.now() / 1000);
  // last completed bucket = the bucket strictly before the current one
  const lastCompletedBucketStart = bucketStart(nowTs, bucket) - bucket;
  const toTs = lastCompletedBucketStart + bucket; // exclusive end

  const cursor = await readCursor(db, adapter.name);
  let fromTs: number;
  if (cursor === null) {
    fromTs = bucketStart(nowTs - config.backfillMinutes * 60, bucket);
    console.log(`[nugget] cold start — backfilling from ${new Date(fromTs * 1000).toISOString()}`);
  } else {
    fromTs = cursor; // resume from the last ingested bucket start (re-does it, upsert-safe)
  }

  // safety cap: never fetch more than ~6h in one run (protects free-tier quotas
  // if the cursor is very stale)
  const maxSpan = 6 * 3600;
  if (toTs - fromTs > maxSpan) {
    console.warn(`[nugget] window ${toTs - fromTs}s exceeds cap; clamping to ${maxSpan}s`);
    fromTs = toTs - maxSpan;
  }

  if (toTs <= fromTs) {
    console.log(`[nugget] nothing new to ingest (current bucket still open). done.`);
    return;
  }
  console.log(
    `[nugget] window ${new Date(fromTs * 1000).toISOString()} -> ${new Date(toTs * 1000).toISOString()}`,
  );

  // 3. fetch + rollup + upsert
  const events = await adapter.fetchEvents(poolIds, fromTs, toTs);
  console.log(`[nugget] fetched ${events.length} events`);
  const rows = rollupEvents(events, bucket);
  await upsertPulse(db, rows);
  console.log(`[nugget] upserted ${rows.length} pulse rows`);

  // 4. advance cursor to the last completed bucket
  await writeCursor(db, adapter.name, lastCompletedBucketStart, `rows=${rows.length}`);

  console.log(`[nugget] done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(`[nugget] FATAL: ${err instanceof Error ? err.stack : err}`);
  process.exit(1);
});

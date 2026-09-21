/**
 * Local pipeline proof — NO network, NO Supabase, NO API keys.
 *
 * Runs the mock adapter through the exact same rollup + velocity code the real
 * worker uses, over the last hour split into 5-minute buckets, and prints the
 * result so you can see the pipeline actually produces sane pulse rows and
 * velocity labels before wiring up live keys.
 *
 *   npm run verify
 */
import { MockAdapter } from "../src/ingest/adapters/mock";
import { rollupEvents, bucketStart, classifyVelocity } from "../src/lib/pulse";
import type { Pulse5m } from "../src/lib/types";

const BUCKET = 300; // 5 minutes

function fmt(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

async function main() {
  const adapter = new MockAdapter();
  const now = Math.floor(Date.now() / 1000);
  const from = bucketStart(now - 60 * 60, BUCKET); // last hour
  const to = bucketStart(now, BUCKET);

  const pools = await adapter.listTopPools(10);
  const poolIds = pools.map((p) => p.id);
  const events = await adapter.fetchEvents(poolIds, from, to);
  const rows = rollupEvents(events, BUCKET);

  console.log(`\n=== NUGGET pipeline verify (mock) ===`);
  console.log(`window: ${new Date(from * 1000).toISOString()} -> ${new Date(to * 1000).toISOString()}`);
  console.log(`pools: ${poolIds.length}  events: ${events.length}  pulse rows: ${rows.length}\n`);

  // sanity assertions
  const assert = (cond: boolean, msg: string) => {
    if (!cond) {
      console.error(`  ✗ ASSERT FAILED: ${msg}`);
      process.exitCode = 1;
    } else {
      console.log(`  ✓ ${msg}`);
    }
  };
  assert(events.length > 0, "adapter produced events");
  assert(rows.length > 0, "rollup produced pulse rows");
  assert(
    rows.every((r) => r.volumeUsd >= 0 && r.feesUsd >= 0),
    "no negative volume/fees",
  );
  assert(
    rows.every((r) => new Date(r.bucketStart).getTime() % (BUCKET * 1000) === 0),
    "every bucket_start is 5m-aligned",
  );
  const totalSwaps = rows.reduce((s, r) => s + r.swapCount, 0);
  assert(totalSwaps > 0, "swaps were counted");

  // show one pool's pulse timeline + a velocity read on the latest window
  const byPool = new Map<string, Pulse5m[]>();
  for (const r of rows) {
    const arr = byPool.get(r.poolId) ?? [];
    arr.push(r);
    byPool.set(r.poolId, arr);
  }

  for (const [poolId, series] of byPool) {
    series.sort((a, b) => a.bucketStart.localeCompare(b.bucketStart));
    const pool = pools.find((p) => p.id === poolId)!;
    console.log(`\n--- ${pool.token0Symbol} / ${pool.token1Symbol}  (${pool.dex}) ---`);
    console.log(`time (UTC)   fees      volume     liq_net    swaps`);
    for (const r of series) {
      const t = r.bucketStart.slice(11, 16);
      console.log(
        `${t}        ${fmt(r.feesUsd).padEnd(9)} ${fmt(r.volumeUsd).padEnd(10)} ${(r.liquidityAddUsd - r.liquidityRmUsd >= 0 ? "+" : "") + fmt(r.liquidityAddUsd - r.liquidityRmUsd)}   ${r.swapCount}`,
      );
    }

    // velocity: latest window vs average of the prior windows
    if (series.length >= 2) {
      const latest = series[series.length - 1]!;
      const prior = series.slice(0, -1);
      const baselineAvg =
        prior.reduce((s, r) => s + r.feesUsd, 0) / prior.length;
      const v = classifyVelocity(latest.feesUsd, baselineAvg);
      console.log(
        `  fee velocity (latest ${fmt(latest.feesUsd)} vs avg ${fmt(baselineAvg)}): ${v.label} (${v.ratio.toFixed(2)}x)`,
      );
    }
  }

  console.log(
    `\n${process.exitCode ? "❌ verify FAILED" : "✅ verify PASSED — pipeline math is sound"}\n`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

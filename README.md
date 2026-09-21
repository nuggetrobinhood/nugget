# 🍗 NUGGET

**Small signals. Big picture.**

LP intelligence for Robinhood Chain. Not a DEX, not an auto-trader, not a
recommendation engine. NUGGET shows LPs what's happening to a pool and their
position in the last 5 minutes.

Runs entirely on free tiers: **GitHub Actions + Supabase + Vercel.**

---

## Architecture

```
Bitquery GraphQL (Uniswap v3 + v4 on RHC, one schema)
        │  fetchEvents(pools, from, to)  -> normalized PoolEvent[]
        ▼
GitHub Actions cron (*/5)  ──►  ingest worker  ──►  Supabase
   (every 5 min, gap-safe)      rollup into 5m       pool_pulse_5m (rollups only)
                                buckets + upsert      pg_cron: 5m→hourly→prune
        │
        ▼
Vercel (Next.js)  ──►  reads Supabase (anon key)  ──►  5M Pulse / Activity / Positions
```

Two decisions that keep this inside the free tier:

1. **Ingest is on GitHub Actions, not Vercel Cron.** Vercel Hobby caps cron at
   once per day; we need every 5 minutes. The worker is a plain Node script.
2. **We store rollups, never raw events.** One row per pool per 5-minute window,
   downsampled to hourly after 7 days and pruned — so 500MB lasts.

The data source sits behind one interface (`IngestAdapter`). Swapping Bitquery
for a Goldsky subgraph or raw RPC means writing one class; nothing else changes.

---

## What's built (V1 backend)

- `supabase/schema.sql` — pools, `pool_pulse_5m`, `pool_hourly`, cursor, positions, RLS
- `supabase/prune.sql` — pg_cron downsample + prune + keepalive
- `src/ingest/` — adapter interface, Bitquery adapter (v3+v4), mock adapter, rollup worker
- `src/lib/pulse.ts` — bucketing, velocity classifier, range-health (all pure/testable)
- `.github/workflows/ingest.yml` — the every-5-min cron
- `scripts/verify.ts` — proves the pipeline with zero network/keys

The frontend (Next.js 5M Pulse UI + thin position monitor) is the next piece.

---

## Prove it locally (no accounts needed)

```bash
npm install
npm run verify      # runs mock data through the real rollup + velocity code
npm run typecheck
```

`verify` prints a per-pool 5-minute pulse timeline and a velocity label, and
asserts the buckets are aligned and the math is sane.

---

## Deploy (≈15 min, your accounts)

> You do the dashboard clicks — I don't take your credentials. Each step says
> exactly what to paste where.

### 1. Supabase
1. Create a project at supabase.com (free tier).
2. **SQL Editor → New query →** paste all of `supabase/schema.sql` → Run.
3. **Database → Extensions →** enable `pg_cron`.
4. **SQL Editor →** paste `supabase/prune.sql` → Run.
5. **Project Settings → API →** copy the **Project URL** and the **service_role**
   key (for the worker) and the **anon** key (for the frontend, later).

### 2. Bitquery
1. Sign in at ide.bitquery.io → account → create an **API key**.
2. In the IDE, confirm the RHC network slug: run any `EVM(network: robinhood …)`
   query. If `robinhood` isn't the slug, note the correct one — you'll set it as
   `BITQUERY_NETWORK`. (Everything else stays the same.)

### 3. GitHub
1. Push this repo to a **public** GitHub repo (public = free Actions minutes).
2. **Settings → Secrets and variables → Actions →** add:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `BITQUERY_API_KEY`
   - `BITQUERY_ENDPOINT` = `https://streaming.bitquery.io/graphql`
   - `BITQUERY_NETWORK` = `robinhood` (or the slug you confirmed)
3. **Actions tab →** enable workflows → run **nugget-ingest** once manually
   (workflow_dispatch) to confirm it writes rows. Then it runs every 5 min.

Check Supabase → Table Editor → `pool_pulse_5m` for rows.

### 4. Vercel (once the frontend lands)
Import the repo, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
deploy. Frontend only reads — the anon key is safe in the browser under RLS.

---

## Free-tier headroom

- Ingest ≈ 8,640 runs/month — GitHub Actions free (public repo) and Supabase
  edge/API well under limits.
- DB stays small because only rollups are stored and old rows are pruned.
- The pg_cron jobs keep the Supabase project active, so it never auto-pauses.
- The one cost that can appear later isn't hosting — it's Bitquery query volume
  if you track many pools at high frequency. V1 (40 pools, 5-min) is comfortable.

---

## Verify-on-deploy notes

The Bitquery GraphQL field names and the RHC network slug are the only things
that need confirming against the live schema (marked in
`src/ingest/adapters/bitquery.ts`). If a field is off, fix it there — the rest
of the pipeline is isolated from it and already proven on mock data.

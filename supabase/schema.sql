-- ===========================================================================
-- NUGGET — Supabase schema
-- LP intelligence for Robinhood Chain.
--
-- Design rule for the 500MB free tier: we NEVER store raw swap events.
-- We store 5-minute rollups (one row per pool per window), roll those up to
-- hourly for older data, and prune aggressively. See prune.sql.
--
-- Run this once in: Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. pools — the tracked-pool registry.
--    We deliberately track only the top-N active pools (see NUGGET_TRACKED_POOLS),
--    not all 21k pools on the chain. Most are dead memecoin pools.
-- ---------------------------------------------------------------------------
create table if not exists pools (
  id            text primary key,          -- pool contract address (v3) or poolId (v4), lowercased
  dex           text not null,             -- 'uniswap-v3' | 'uniswap-v4'
  token0_symbol text not null,
  token1_symbol text not null,
  token0        text,                      -- token0 address
  token1        text,                      -- token1 address
  fee_tier      integer,                   -- e.g. 500 = 0.05%, 3000 = 0.3%
  label         text generated always as (token0_symbol || ' / ' || token1_symbol) stored,
  is_active     boolean not null default true,
  -- TVL is a CURRENT snapshot, overwritten each ingest run (NOT a time series).
  -- This is what keeps est. APR possible without growing storage. See spec §5.
  tvl_usd       numeric,
  tvl_at        timestamptz,
  first_seen    timestamptz not null default now(),
  last_seen     timestamptz not null default now()
);

create index if not exists pools_active_idx on pools (is_active);
create index if not exists pools_dex_idx    on pools (dex);

-- ---------------------------------------------------------------------------
-- 2. pool_pulse_5m — the heart of NUGGET. One row per pool per 5-minute window.
--    This is what the "5M Pulse", "Fee Velocity", "Liquidity Flow" and
--    "Pool Activity" views read from.
--    bucket_start is the UTC start of the 5-minute window (aligned to :00,:05,...).
-- ---------------------------------------------------------------------------
create table if not exists pool_pulse_5m (
  pool_id            text not null references pools(id) on delete cascade,
  bucket_start       timestamptz not null,

  -- flows within the window
  fees_usd           numeric not null default 0,   -- fees generated this window
  volume_usd         numeric not null default 0,   -- swap volume this window
  liquidity_add_usd  numeric not null default 0,   -- LP deposits this window
  liquidity_rm_usd   numeric not null default 0,   -- LP withdrawals this window
  liquidity_net_usd  numeric generated always as (liquidity_add_usd - liquidity_rm_usd) stored,

  -- counts
  swap_count         integer not null default 0,
  mint_count         integer not null default 0,   -- add-liquidity events
  burn_count         integer not null default 0,   -- remove-liquidity events
  lp_count           integer,                       -- distinct active LPs (nullable if source can't tell)

  -- trust signals (per window) — powers the "is this APR real?" layer
  unique_traders     integer,                       -- distinct swap senders this window
  top_wallet_pct     numeric,                       -- % of window volume from the single biggest wallet

  -- price / state at window close
  price_close        numeric,                       -- token0 price in token1 at window end
  price_open         numeric,                       -- token0 price at window start
  active_liquidity   numeric,                       -- in-range liquidity at window end (raw L)

  updated_at         timestamptz not null default now(),

  primary key (pool_id, bucket_start)
);

create index if not exists pulse_bucket_idx      on pool_pulse_5m (bucket_start desc);
create index if not exists pulse_pool_bucket_idx on pool_pulse_5m (pool_id, bucket_start desc);

-- ---------------------------------------------------------------------------
-- 3. pool_hourly — older data, downsampled from 5m before the 5m rows are pruned.
--    Keeps "Fee History 6h/24h" and longer charts alive without holding 5m rows forever.
-- ---------------------------------------------------------------------------
create table if not exists pool_hourly (
  pool_id            text not null references pools(id) on delete cascade,
  bucket_start       timestamptz not null,          -- aligned to the hour
  fees_usd           numeric not null default 0,
  volume_usd         numeric not null default 0,
  liquidity_add_usd  numeric not null default 0,
  liquidity_rm_usd   numeric not null default 0,
  liquidity_net_usd  numeric generated always as (liquidity_add_usd - liquidity_rm_usd) stored,
  swap_count         integer not null default 0,
  price_close        numeric,
  primary key (pool_id, bucket_start)
);

create index if not exists hourly_bucket_idx on pool_hourly (bucket_start desc);

-- ---------------------------------------------------------------------------
-- 4. ingest_cursor — where the poller left off, per adapter.
--    Gap-safe: the worker resumes from last_bucket so a missed cron run backfills.
-- ---------------------------------------------------------------------------
create table if not exists ingest_cursor (
  source        text primary key,          -- e.g. 'bitquery'
  last_bucket   timestamptz not null,      -- last fully-ingested 5m bucket_start
  last_run_at   timestamptz not null default now(),
  note          text
);

-- ---------------------------------------------------------------------------
-- 5. lp_positions — thin position monitor (V1: no wallet connect).
--    User pastes pair + range; we compute range health / time-in-range against
--    the 5m price series. Anonymous device-scoped id so no auth needed for V1.
-- ---------------------------------------------------------------------------
create table if not exists lp_positions (
  id            uuid primary key default gen_random_uuid(),
  device_id     text not null,             -- random id stored in the browser (localStorage)
  pool_id       text not null references pools(id) on delete cascade,
  lower_price   numeric not null,
  upper_price   numeric not null,
  size_usd      numeric,                   -- optional, for P&L context later
  label         text,
  created_at    timestamptz not null default now()
);

create index if not exists lp_positions_device_idx on lp_positions (device_id);

-- ---------------------------------------------------------------------------
-- RLS — the browser only ever uses the anon key (read-only + own positions).
-- The ingest worker uses the service_role key, which bypasses RLS entirely.
-- ---------------------------------------------------------------------------
alter table pools          enable row level security;
alter table pool_pulse_5m  enable row level security;
alter table pool_hourly    enable row level security;
alter table lp_positions   enable row level security;
-- ingest_cursor stays locked down (no anon policy) — worker-only via service role.
alter table ingest_cursor  enable row level security;

-- Public read of market data (anon key). No writes.
drop policy if exists "public read pools"  on pools;
create policy "public read pools"  on pools         for select using (true);
drop policy if exists "public read pulse"  on pool_pulse_5m;
create policy "public read pulse"  on pool_pulse_5m for select using (true);
drop policy if exists "public read hourly" on pool_hourly;
create policy "public read hourly" on pool_hourly   for select using (true);

-- lp_positions: a device can read + write only its own rows.
-- device_id is passed as a PostgREST header -> request.header. We match it in the policy.
drop policy if exists "device rw positions" on lp_positions;
create policy "device rw positions" on lp_positions
  for all
  using  (device_id = current_setting('request.headers.x-device-id', true))
  with check (device_id = current_setting('request.headers.x-device-id', true));

-- ===========================================================================
-- NUGGET — retention & downsampling (pg_cron)
--
-- This keeps the database comfortably inside the 500MB free tier:
--   * 5-minute rows are kept for 7 days, then downsampled to hourly and dropped.
--   * hourly rows are kept for 90 days.
--
-- pg_cron also doubles as our keepalive: because these jobs touch the DB
-- regularly, the free project never hits the 7-day inactivity auto-pause.
--
-- Run once in the SQL Editor. Requires the pg_cron extension (Supabase:
-- Database -> Extensions -> enable "pg_cron").
-- ===========================================================================

create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- Downsample 5m -> hourly for anything older than 7 days, then delete the 5m rows.
-- Idempotent: re-running just re-upserts the same hourly aggregates.
-- ---------------------------------------------------------------------------
create or replace function nugget_downsample_and_prune() returns void
language plpgsql
as $$
begin
  -- 1. fold 5m rows older than 7 days into hourly buckets
  insert into pool_hourly (
    pool_id, bucket_start, fees_usd, volume_usd,
    liquidity_add_usd, liquidity_rm_usd, swap_count, price_close
  )
  select
    pool_id,
    date_trunc('hour', bucket_start)                as hour_start,
    sum(fees_usd),
    sum(volume_usd),
    sum(liquidity_add_usd),
    sum(liquidity_rm_usd),
    sum(swap_count),
    -- price_close of the latest 5m bucket in the hour
    (array_agg(price_close order by bucket_start desc))[1]
  from pool_pulse_5m
  where bucket_start < now() - interval '7 days'
  group by pool_id, date_trunc('hour', bucket_start)
  on conflict (pool_id, bucket_start) do update set
    fees_usd          = excluded.fees_usd,
    volume_usd        = excluded.volume_usd,
    liquidity_add_usd = excluded.liquidity_add_usd,
    liquidity_rm_usd  = excluded.liquidity_rm_usd,
    swap_count        = excluded.swap_count,
    price_close       = excluded.price_close;

  -- 2. drop the now-folded 5m rows
  delete from pool_pulse_5m where bucket_start < now() - interval '7 days';

  -- 3. drop hourly rows older than 90 days
  delete from pool_hourly where bucket_start < now() - interval '90 days';
end;
$$;

-- ---------------------------------------------------------------------------
-- Schedule: run hourly at :10 past. (pg_cron uses UTC.)
-- ---------------------------------------------------------------------------
select cron.unschedule('nugget-prune')
  where exists (select 1 from cron.job where jobname = 'nugget-prune');

select cron.schedule('nugget-prune', '10 * * * *', $$select nugget_downsample_and_prune();$$);

-- Optional explicit keepalive ping every 3 days (belt-and-suspenders; the prune
-- job already keeps the project active, but this is harmless insurance).
select cron.unschedule('nugget-keepalive')
  where exists (select 1 from cron.job where jobname = 'nugget-keepalive');

select cron.schedule('nugget-keepalive', '0 0 */3 * *', $$select 1;$$);

// Central config, read from env once. Fails loud on missing required vars
// so a misconfigured GitHub Actions run tells you exactly what's wrong.

function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v : fallback;
}

export const RHC_CHAIN_ID = 4663;

export const config = {
  adapter: opt("INGEST_ADAPTER", "mock") as "bitquery" | "geckoterminal" | "mock",

  supabaseUrl: req("SUPABASE_URL"),
  supabaseServiceKey: req("SUPABASE_SERVICE_ROLE_KEY"),

  bitqueryApiKey: opt("BITQUERY_API_KEY", ""),
  bitqueryEndpoint: opt("BITQUERY_ENDPOINT", "https://streaming.bitquery.io/graphql"),

  trackedPools: parseInt(opt("NUGGET_TRACKED_POOLS", "40"), 10),
  bucketSeconds: parseInt(opt("NUGGET_BUCKET_SECONDS", "300"), 10),
  backfillMinutes: parseInt(opt("NUGGET_BACKFILL_MINUTES", "60"), 10),
  // TVL fetch via GeckoTerminal (for est. APR). Off by default until the RHC
  // network slug is confirmed; set NUGGET_ENABLE_TVL=1 to turn it on.
  enableTvl: opt("NUGGET_ENABLE_TVL", "0") === "1",
};

/** Lazy variant: only validate Supabase when we actually need it. */
export function loadConfig() {
  return config;
}

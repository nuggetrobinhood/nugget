// Public (browser-safe) Supabase config for the frontend.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// True once a Supabase project is wired up. Until then the read functions
// return empty results and the pages show a clean empty state — no fake data.
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

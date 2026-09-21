export function usd(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  if (abs >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(4)}`;
}

export function signedUsd(n: number): string {
  return (n >= 0 ? "+" : "") + usd(n);
}

export function feeTierPct(tier: number | null): string {
  if (tier === null) return "";
  return `${(tier / 10_000).toFixed(2)}%`;
}

export function hhmm(iso: string): string {
  return iso.slice(11, 16);
}

export function price(n: number | null): string {
  if (n === null) return "—";
  if (n >= 100) return `$${n.toFixed(2)}`;
  if (n >= 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(6)}`;
}

// USD-stable quote tokens on Robinhood Chain.
const USD_SYMS = new Set(["USDG", "USDB", "USDC", "USDT", "DAI", "USD", "FRAX", "GHO", "USDE", "PYUSD"]);
export function isUsdQuote(sym: string | null | undefined): boolean {
  return sym ? USD_SYMS.has(sym.toUpperCase()) : false;
}

/** A token's USD price (derived from swap AmountInUSD ÷ Amount — direction-safe). */
export function usdPrice(n: number | null | undefined): string {
  if (n === null || n === undefined || !(n > 0)) return "—";
  if (n >= 1000) return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  if (n >= 0.01) return `$${n.toFixed(4)}`;
  if (n >= 0.000001) return `$${n.toFixed(6)}`;
  return "<$0.000001";
}

export function apr(n: number | null): string {
  if (n === null) return "—";
  if (n >= 1000) return `~${(n / 1000).toFixed(1)}k%`;
  return `~${n.toFixed(0)}%`;
}

export function multiple(n: number): string {
  if (n <= 0) return "—";
  return `${n.toFixed(1)}×`;
}

export const RISK_LABELS: Record<string, string> = {
  "thin-tvl": "Thin TVL",
  "one-wallet": "1-wallet volume",
  "few-traders": "Few traders",
  "new-pool": "New",
};

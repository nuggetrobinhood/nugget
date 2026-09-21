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


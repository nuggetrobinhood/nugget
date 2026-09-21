// ============================================================================
// NUGGET — LP P&L truth engine.
//
// This is the thing a plain APR scanner never tells you: once you're actually
// providing liquidity, your real outcome is  fees − impermanent loss − gas.
// A pool can show a fat APR and still leave you behind holding, because price
// drift quietly bleeds value out of the position. NUGGET makes that knowable.
//
// Pure functions, no IO — unit-testable and safe to run on the client.
//
// Convention: `price` everywhere is token0's price in USD (the same number
// NUGGET stores as priceClose and shows on the ticker). token1 is treated as
// the USD numeraire, which is the common case on RHC (…/USDG, …/USDC pools).
// For a token0/token1 pool where token1 isn't a stable, the math still holds
// as a ratio — it just reads as "value in token1" rather than USD.
// ============================================================================

const HOURS_PER_YEAR = 24 * 365;

export interface PnlInput {
  /** USD value deposited into the position at entry. */
  deposit: number;
  /** token0 USD price at entry. */
  entryPrice: number;
  /** token0 USD price now (or at the end of the backtest window). */
  currentPrice: number;
  /** Pool fee APR estimate, in percent (e.g. 42 = 42%). */
  aprPct: number;
  /** Hours the position has been (or would have been) live. */
  hours: number;
  /** Total gas paid, USD — entry + exit. */
  gasUsd: number;
  /** Concentrated range lower bound (token0 USD price). Omit for full range. */
  lower?: number;
  /** Concentrated range upper bound. Omit for full range. */
  upper?: number;
}

export interface PnlResult {
  /** Fees earned over the window (only while in range). */
  fees: number;
  /** Impermanent loss vs holding, USD. ≤ 0. */
  ilUsd: number;
  /** IL as a fraction of deposit, percent. ≤ 0. */
  ilPct: number;
  /** Gas cost, USD (echoed for the breakdown). */
  gas: number;
  /** The headline: fees − |IL| − gas. What LPing earned you over holding. */
  netVsHodl: number;
  /** Current USD value of the LP position. */
  positionValue: number;
  /** What the same tokens would be worth if you'd just held them. */
  hodlValue: number;
  /** Price change over the window, percent. */
  priceChangePct: number;
  /** Is price currently inside the range? (Always true for full range.) */
  inRange: boolean;
  /** Fraction of the window price spent inside the range is unknown; when the
   *  position is out of range NOW we flag that fees have stopped. */
  earningNow: boolean;
  /** True when a range was supplied (concentrated), false for full range. */
  concentrated: boolean;
}

/** Full-range (constant-product, 50/50) position value at ratio r = P1/P0. */
function fullRange(deposit: number, r: number) {
  // HODL: half the deposit tracks price, half is the stable side.
  const hodl = (deposit * (1 + r)) / 2;
  // LP value for a 50/50 AMM position = V0 · √r.
  const lp = deposit * Math.sqrt(r);
  return { hodl, lp };
}

/**
 * Concentrated (Uniswap v3) position value.
 *
 * Solve liquidity L from the deposit at entry price P0 inside [pa, pb], then
 * value the position at P1 and compare to holding the entry token amounts.
 */
function concentrated(
  deposit: number,
  p0: number,
  p1: number,
  pa: number,
  pb: number,
) {
  const sqrt = Math.sqrt;
  const sp0 = sqrt(p0);
  const spa = sqrt(pa);
  const spb = sqrt(pb);

  // clamp entry price into the range for the L solve (if you entered out of
  // range the position is single-sided; treat entry as the nearer bound)
  const p0c = Math.min(Math.max(p0, pa), pb);
  const sp0c = sqrt(p0c);

  // deposit = L · (2√P0 − P0/√pb − √pa)   for pa ≤ P0 ≤ pb
  const denom = 2 * sp0c - p0c / spb - spa;
  const L = denom > 0 ? deposit / denom : 0;

  // entry token amounts (for the HODL comparison)
  const x0 = L * (1 / sp0c - 1 / spb); // token0
  const y0 = L * (sp0c - spa); // token1 (USD)

  const valueAt = (p: number) => {
    if (p <= pa) return L * (1 / spa - 1 / spb) * p; // all token0
    if (p >= pb) return L * (spb - spa); // all token1
    const sp = sqrt(p);
    return L * (2 * sp - p / spb - spa);
  };

  const lp = valueAt(p1);
  const hodl = x0 * p1 + y0;
  return { hodl, lp };
}

export function computePnl(input: PnlInput): PnlResult {
  const { deposit, entryPrice, currentPrice, aprPct, hours, gasUsd } = input;
  const hasRange =
    typeof input.lower === "number" &&
    typeof input.upper === "number" &&
    input.lower > 0 &&
    input.upper > input.lower;

  const p0 = entryPrice > 0 ? entryPrice : 1;
  const p1 = currentPrice > 0 ? currentPrice : p0;
  const r = p1 / p0;

  const { hodl, lp } = hasRange
    ? concentrated(deposit, p0, p1, input.lower!, input.upper!)
    : fullRange(deposit, r);

  const ilUsd = lp - hodl; // ≤ 0, dollar loss vs holding
  // Impermanent loss %, by the standard convention: relative to the hold value,
  // so a 2× (or ½×) move reads as the familiar −5.7%.
  const ilPct = hodl > 0 ? (ilUsd / hodl) * 100 : 0;

  const inRange = hasRange ? p1 >= input.lower! && p1 <= input.upper! : true;
  const earningNow = inRange;

  // Fee estimate: APR prorated over the hours held. Concentrated liquidity
  // boosts fees relative to its capital, but only while price is inside the
  // range — so if you're out of range now we don't keep accruing.
  const feeFrac = (aprPct / 100) * (hours / HOURS_PER_YEAR);
  const fees = Math.max(0, deposit * feeFrac);

  const netVsHodl = fees + ilUsd - gasUsd;

  return {
    fees,
    ilUsd,
    ilPct,
    gas: gasUsd,
    netVsHodl,
    positionValue: lp,
    hodlValue: hodl,
    priceChangePct: (r - 1) * 100,
    inRange,
    earningNow,
    concentrated: hasRange,
  };
}

/** How long a set of hours reads to a human ("18h", "3.5d", "2.1w"). */
export function humanDuration(hours: number): string {
  if (!isFinite(hours) || hours <= 0) return "0h";
  if (hours < 48) return `${hours % 1 === 0 ? hours : hours.toFixed(1)}h`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(1)}d`;
  return `${(days / 7).toFixed(1)}w`;
}

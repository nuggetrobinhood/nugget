import Link from "next/link";
import { getPoolDetail } from "../../../lib/data";
import { Nav, Footer } from "../../../components/Chrome";
import { VelocityBadge } from "../../../components/Velocity";
import { usd, signedUsd, hhmm, price, feeTierPct } from "../../../lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PoolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const detail = await getPoolDetail(id);

  if (!detail) {
    return (
      <>
        <Nav />
        <main className="wrap">
          <Link href="/" className="back">
            ← Pulse
          </Link>
          <div className="panel">Pool not found or no recent activity.</div>
        </main>
        <Footer />
      </>
    );
  }

  const { summary: s, series, feeHorizons: h } = detail;
  const maxVol = Math.max(1, ...series.map((w) => w.volumeUsd));

  return (
    <>
      <Nav />
      <main className="wrap">
        <Link href="/" className="back">
          ← Pulse
        </Link>

        <div className="card-top" style={{ marginBottom: 10 }}>
          <div className="pair" style={{ fontSize: 26 }}>
            {s.label}
            {s.feeTier !== null && <span className="fee">{feeTierPct(s.feeTier)}</span>}
          </div>
          <span className="dexchip">{s.dex.replace("uniswap-", "Uni ").toUpperCase()}</span>
        </div>

        <div style={{ display: "flex", gap: 14, alignItems: "center", marginBottom: 8 }}>
          <VelocityBadge label={s.velocity} ratio={s.velocityRatio} />
          <span style={{ color: "var(--muted)", fontSize: 14 }}>
            price {price(s.priceClose)}
          </span>
        </div>

        <div className="section-label">Fee generation</div>
        <div className="panel">
          <div className="horizons">
            {(
              [
                ["5m", h.m5],
                ["30m", h.m30],
                ["1h", h.h1],
                ["6h", h.h6],
                ["24h", h.h24],
              ] as const
            ).map(([k, v]) => (
              <div className="h" key={k}>
                <div className="k">{k}</div>
                <div className="v">{usd(v)}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section-label">Pool activity — last {series.length} windows</div>
        <div className="panel">
          <table className="timeline">
            <tbody>
              {[...series].reverse().map((w) => (
                <tr key={w.bucketStart}>
                  <td className="t">{hhmm(w.bucketStart)}</td>
                  <td className="n">{usd(w.volumeUsd)}</td>
                  <td className="n" style={{ width: 110 }}>
                    <div className="bar">
                      <i style={{ width: `${(w.volumeUsd / maxVol) * 100}%` }} />
                    </div>
                  </td>
                  <td className="n">{usd(w.feesUsd)} fees</td>
                  <td className={`n ${w.liquidityNetUsd >= 0 ? "pos" : "neg"}`}>
                    {signedUsd(w.liquidityNetUsd)}
                  </td>
                  <td className="n" style={{ color: "var(--muted)", width: 60 }}>
                    {w.swapCount} sw
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="note">
          Reading the story: volume up → fees up → is liquidity following, or
          leaving? That context is the point — not a single APR number.
        </p>

        <div style={{ marginTop: 22 }}>
          <Link href={`/positions?pool=${encodeURIComponent(s.id)}`}>
            <button className="go">Monitor a position in this pool →</button>
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}

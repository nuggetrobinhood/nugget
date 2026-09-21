import Link from "next/link";
import { getPoolDetail } from "../../../lib/data";
import { getPoolLive } from "../../../lib/live";
import { computePoolSignals } from "../../../lib/signals";
import { PoolDetail } from "../../../components/PoolDetail";

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
        <Link href="/" className="back">← Back to Pulse</Link>
        <div className="panel" style={{ marginTop: 14 }}>Pool not found or no recent activity.</div>
      </>
    );
  }

  const live = await getPoolLive(id, detail.summary.token0Symbol);
  const signals = computePoolSignals(detail);

  return <PoolDetail detail={detail} live={live} signals={signals} />;
}

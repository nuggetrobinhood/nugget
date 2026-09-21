import { getPulse } from "../lib/data";
import { PulseView } from "../components/PulseView";
import { WINDOWS, type Window } from "../lib/model";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PulsePage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  // NUGGET's whole point is the last 5 minutes — default to the pulse window,
  // not the generic 24h view.
  const window: Window = WINDOWS.includes(w as Window) ? (w as Window) : "5m";
  const data = await getPulse(window);

  return <PulseView data={data} />;
}

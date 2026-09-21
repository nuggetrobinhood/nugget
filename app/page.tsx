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
  const window: Window = WINDOWS.includes(w as Window) ? (w as Window) : "24h";
  const data = await getPulse(window);

  return <PulseView data={data} />;
}

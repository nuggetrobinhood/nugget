import { getPulse } from "../lib/data";
import { Nav, Footer } from "../components/Chrome";
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
  const window: Window = WINDOWS.includes(w as Window) ? (w as Window) : "5m";
  const data = await getPulse(window);

  return (
    <>
      <Nav active="pulse" />
      <main className="wrap">
        <div className="page-head">
          <h1>Pulse</h1>
          <p>
            What&apos;s moving on Robinhood Chain right now. Ranked by the data —
            not our picks.
          </p>
        </div>
        <PulseView data={data} />
      </main>
      <Footer />
    </>
  );
}

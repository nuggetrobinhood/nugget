import { Nav, Footer } from "../../components/Chrome";

export const metadata = { title: "How it works — NUGGET" };

export default function HowItWorksPage() {
  return (
    <>
      <Nav active="how" />
      <main className="wrap">
        <div className="page-head">
          <h1>How it works</h1>
          <p>Four signals, read together, tell you what a single number can&apos;t.</p>
        </div>

        <div className="prose">
          <div className="steps">
            <div className="step">
              <div className="num" />
              <div className="body">
                <h3>5-Minute Pulse</h3>
                <p>
                  Every 5 minutes NUGGET reads each active pool: fees generated,
                  volume, liquidity in/out, swaps. The Pulse grid ranks pools by
                  fees in the latest window, so the pools doing something right
                  now rise to the top.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="num" />
              <div className="body">
                <h3>Fee velocity</h3>
                <p>
                  Not just how much fee a pool made, but how fast it&apos;s making
                  it. NUGGET compares the latest window to the last hour and
                  labels it Accelerating, Stable, or Cooling. The comparison is
                  smoothed against a rolling baseline so one big swap doesn&apos;t
                  make the label flicker.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="num" />
              <div className="body">
                <h3>Liquidity flow</h3>
                <p>
                  Fees rising is only half the story. NUGGET also tracks whether
                  LPs are adding or pulling liquidity. High fees while liquidity
                  leaves reads very differently from high fees while it flows in —
                  and that context is the point.
                </p>
              </div>
            </div>

            <div className="step">
              <div className="num" />
              <div className="body">
                <h3>Range health</h3>
                <p>
                  For a concentrated-liquidity position, you only earn while price
                  sits inside your range. Paste your range on the Positions page
                  and NUGGET shows how far you are through it and how close you are
                  to going idle — no wallet connect, saved on your device.
                </p>
              </div>
            </div>
          </div>

          <h2>What it doesn&apos;t do</h2>
          <p>
            NUGGET never tells you a pool is &quot;better&quot; or that you should
            rebalance now. It reads activity and shows it plainly; the decision is
            yours. Velocity labels are about change in activity, not price
            predictions. Not financial advice.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

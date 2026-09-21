import { Nav, Footer } from "../../components/Chrome";

export const metadata = { title: "About — NUGGET" };

export default function AboutPage() {
  return (
    <>
      <Nav active="about" />
      <main className="wrap">
        <div className="page-head">
          <h1>About NUGGET</h1>
          <p>Small signals. Big picture.</p>
        </div>

        <div className="prose">
          <p>
            NUGGET is <strong>LP intelligence for Robinhood Chain</strong>. It
            helps people who actively provide liquidity understand what&apos;s
            happening to a pool and to their position — in the last 5 minutes,
            not the last 24 hours.
          </p>
          <p>
            Most tools hand LPs a single APR number. That number hides the story:
            is volume rising or fading, are fees accelerating, is liquidity
            flowing in or quietly leaving? NUGGET surfaces those small signals so
            you can assemble the big picture yourself.
          </p>

          <h2>What NUGGET is not</h2>
          <div className="not-list">
            <div className="item">
              <span className="x">✕</span>
              <span>
                <strong>Not a DEX.</strong> You provide liquidity on Uniswap.
                NUGGET only reads.
              </span>
            </div>
            <div className="item">
              <span className="x">✕</span>
              <span>
                <strong>Not an auto-trader.</strong> It never moves funds or
                signs a transaction.
              </span>
            </div>
            <div className="item">
              <span className="x">✕</span>
              <span>
                <strong>Not a recommendation engine.</strong> It shows the data;
                you decide.
              </span>
            </div>
            <div className="item">
              <span className="x">✕</span>
              <span>
                <strong>Not just an APR scanner.</strong> It reads change in
                activity, not one static yield.
              </span>
            </div>
          </div>

          <h2>What it is</h2>
          <div className="not-list">
            <div className="item">
              <span className="c">✓</span>
              <span>
                A <strong>read-only pulse</strong> on the most active pools —
                Uniswap v3 and v4 — updated every 5 minutes.
              </span>
            </div>
            <div className="item">
              <span className="c">✓</span>
              <span>
                A <strong>position monitor</strong> that tells you how close your
                range is to going idle — no wallet connect.
              </span>
            </div>
          </div>

          <h2>Evidence, not opinions</h2>
          <p>
            NUGGET is deliberately conservative. Velocity labels describe whether
            activity is speeding up or cooling down — they are not price
            predictions. Nothing here is financial advice, and NUGGET is not
            affiliated with Robinhood Markets, Inc.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}

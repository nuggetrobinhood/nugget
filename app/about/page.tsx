export const metadata = { title: "About — NUGGET" };

function HeroArt() {
  return (
    <svg className="hero-art" viewBox="0 0 600 220" fill="none" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="ab-nug" cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFE49B" /><stop offset="0.45" stopColor="#F6B93B" /><stop offset="1" stopColor="#C67D14" />
        </radialGradient>
        <linearGradient id="ab-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2fe04a" stopOpacity="0.85" /><stop offset="1" stopColor="#00c805" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      {[40, 90, 140, 190, 240, 290, 340].map((x, i) => (
        <rect key={x} x={x} y={150 - [40, 70, 55, 95, 80, 120, 100][i]!} width="26" height={[40, 70, 55, 95, 80, 120, 100][i]} rx="4" fill="url(#ab-bar)" />
      ))}
      <line x1="20" y1="150" x2="400" y2="150" stroke="#1f2a24" strokeWidth="1.5" />
      <g transform="translate(470,110)">
        <g fill="none" stroke="#00c805" strokeLinecap="round">
          <path d="M42 -34 A42 42 0 0 1 42 34" strokeWidth="5" opacity="0.9" />
          <path d="M60 -52 A64 64 0 0 1 60 52" strokeWidth="5" opacity="0.5" />
          <path d="M78 -70 A86 86 0 0 1 78 70" strokeWidth="5" opacity="0.25" />
        </g>
        <path d="M-34 6 C-36 -18 -14 -30 4 -24 C24 -34 60 -24 60 8 C74 16 70 42 50 48 C42 70 6 72 -8 60 C-36 62 -46 30 -34 6 Z" fill="url(#ab-nug)" />
        <ellipse cx="-8" cy="-4" rx="20" ry="13" fill="#fff" opacity="0.45" />
      </g>
    </svg>
  );
}

const NOT = [
  ["Not a DEX", "You provide liquidity on Uniswap. NUGGET only reads."],
  ["Not an auto-trader", "It never moves funds or signs a transaction."],
  ["Not a recommendation engine", "It shows the data; you decide."],
  ["Not just an APR scanner", "It reads change in activity, not one static yield."],
];
const IS = [
  ["A read-only pulse", "On the most active pools — Uniswap v3 and v4 — updated every 5 minutes."],
  ["A position monitor", "Tells you how close your range is to going idle. No wallet connect."],
];

export default function AboutPage() {
  return (
    <>
      <div className="page-head">
        <h1>About NUGGET</h1>
        <p>Small signals. Big picture.</p>
      </div>

      <div className="art-panel"><HeroArt /></div>

      <div className="prose">
        <p>
          NUGGET is <strong>LP intelligence for Robinhood Chain</strong>. It helps
          people who actively provide liquidity understand what&apos;s happening to
          a pool and to their position — in the last 5 minutes, not the last 24 hours.
        </p>
        <p>
          Most tools hand LPs a single APR number. That number hides the story: is
          volume rising or fading, are fees accelerating, is liquidity flowing in or
          quietly leaving? NUGGET surfaces those small signals so you can assemble
          the big picture yourself.
        </p>

        <h2>What NUGGET is not</h2>
        <div className="feature-grid">
          {NOT.map(([t, d]) => (
            <div className="fcard" key={t}>
              <span className="fic x">✕</span>
              <div><strong>{t}.</strong> {d}</div>
            </div>
          ))}
        </div>

        <h2>What it is</h2>
        <div className="feature-grid">
          {IS.map(([t, d]) => (
            <div className="fcard" key={t}>
              <span className="fic c">✓</span>
              <div><strong>{t}</strong> — {d}</div>
            </div>
          ))}
        </div>

        <h2>Evidence, not opinions</h2>
        <p>
          NUGGET is deliberately conservative. Velocity labels describe whether
          activity is speeding up or cooling down — they are not price predictions.
          Nothing here is financial advice, and NUGGET is not affiliated with
          Robinhood Markets, Inc.
        </p>
      </div>
    </>
  );
}

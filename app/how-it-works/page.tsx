export const metadata = { title: "How it works — NUGGET" };

function FlowArt() {
  return (
    <svg className="hero-art" viewBox="0 0 600 150" fill="none" aria-hidden preserveAspectRatio="xMidYMid meet">
      <defs>
        <marker id="arw" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="#3a4a40" />
        </marker>
      </defs>
      {[
        [70, "Robinhood Chain", "Uniswap v3 / v4 swaps"],
        [300, "NUGGET ingest", "every 5 minutes"],
        [530, "Pulse", "ranked by fees"],
      ].map(([x, a, b], i) => (
        <g key={i as number} transform={`translate(${(x as number) - 70},40)`}>
          <rect x="0" y="0" width="140" height="70" rx="12" fill="#0d121b" stroke="#1f2a24" />
          <circle cx="24" cy="26" r="6" fill={["#00c805", "#f5b301", "#2fe04a"][i]} />
          <text x="40" y="30" fill="#eef2f7" fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">{a as string}</text>
          <text x="20" y="52" fill="#8a95a5" fontSize="11" fontFamily="Inter, sans-serif">{b as string}</text>
        </g>
      ))}
      <line x1="140" y1="75" x2="228" y2="75" stroke="#3a4a40" strokeWidth="2" markerEnd="url(#arw)" />
      <line x1="370" y1="75" x2="458" y2="75" stroke="#3a4a40" strokeWidth="2" markerEnd="url(#arw)" />
    </svg>
  );
}

const STEP_ICON: Record<string, React.ReactNode> = {
  pulse: <path d="M3 12h4l3-9 4 18 3-9h4" />,
  velocity: (
    <>
      <path d="M4 15a8 8 0 0 1 16 0" />
      <path d="M12 15l4-4" />
    </>
  ),
  flow: (
    <>
      <path d="M4 9h11M11 5l4 4-4 4" />
      <path d="M20 15H9M13 19l-4-4 4-4" />
    </>
  ),
  range: (
    <>
      <rect x="3" y="10" width="18" height="5" rx="2.5" />
      <path d="M14 7v11" />
    </>
  ),
};

const STEPS: [string, string, string][] = [
  ["pulse", "5-minute pulse", "Every 5 minutes NUGGET reads each active pool: fees generated, volume, liquidity in/out, swaps. The Pulse grid ranks pools by fees in the latest window, so the pools doing something right now rise to the top."],
  ["velocity", "Fee velocity", "Not just how much fee a pool made, but how fast it's making it. NUGGET compares the latest window to the last hour and labels it Accelerating, Stable, or Cooling — smoothed against a rolling baseline so one big swap doesn't make the label flicker."],
  ["flow", "Liquidity flow", "Fees rising is only half the story. High fees while liquidity leaves reads very differently from high fees while it flows in — and that context is the point."],
  ["range", "Range health", "For a concentrated-liquidity position, you only earn while price sits inside your range. Paste your range on the Positions page and NUGGET shows how far through it you are and how close you are to going idle — no wallet connect, saved on your device."],
];

export default function HowItWorksPage() {
  return (
    <>
      <div className="page-head">
        <h1>How it works</h1>
        <p>Four signals, read together, tell you what a single number can&apos;t.</p>
      </div>

      <div className="art-panel"><FlowArt /></div>

      <div className="how-steps">
        {STEPS.map(([icon, title, body], i) => (
          <div className="how-step" key={title}>
            <div className="hs-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                {STEP_ICON[icon]}
              </svg>
              <span className="hs-num">{i + 1}</span>
            </div>
            <div className="hs-body">
              <h3>{title}</h3>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="prose">
        <h2>What it doesn&apos;t do</h2>
        <p>
          NUGGET never tells you a pool is &quot;better&quot; or that you should
          rebalance now. It reads activity and shows it plainly; the decision is
          yours. Velocity labels are about change in activity, not price
          predictions. Not financial advice.
        </p>
      </div>
    </>
  );
}

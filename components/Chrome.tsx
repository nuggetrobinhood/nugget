import Link from "next/link";

const GITHUB_URL = "https://github.com/"; // ← ganti ke repo lo setelah push

// NUGGET logo — 3D glossy nugget + pulse waves (concept #6).
let _logoId = 0;
function LogoMark({ size = 28 }: { size?: number }) {
  const uid = `lg${_logoId++}`;
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden style={{ display: "block" }}>
      <defs>
        <radialGradient id={`${uid}b`} cx="38%" cy="30%" r="80%">
          <stop offset="0" stopColor="#FFE49B" />
          <stop offset="0.42" stopColor="#F6B93B" />
          <stop offset="0.8" stopColor="#E09A24" />
          <stop offset="1" stopColor="#B76E12" />
        </radialGradient>
        <radialGradient id={`${uid}s`} cx="34%" cy="26%" r="42%">
          <stop offset="0" stopColor="#fff" stopOpacity="0.6" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}c`}>
          <path d="M62 82 C60 58 82 46 100 52 C120 42 158 52 158 84 C176 94 172 122 150 130 C142 156 104 160 88 146 C58 148 46 110 62 82 Z" />
        </clipPath>
      </defs>
      <g fill="none" stroke="#F0A62B" strokeLinecap="round">
        <path d="M150 74 A34 34 0 0 1 150 126" strokeWidth="9" opacity="0.95" />
        <path d="M164 60 A52 52 0 0 1 164 140" strokeWidth="9" opacity="0.55" />
        <path d="M178 46 A70 70 0 0 1 178 154" strokeWidth="9" opacity="0.28" />
      </g>
      <path d="M62 82 C60 58 82 46 100 52 C120 42 158 52 158 84 C176 94 172 122 150 130 C142 156 104 160 88 146 C58 148 46 110 62 82 Z" fill={`url(#${uid}b)`} />
      <g clipPath={`url(#${uid}c)`}>
        <ellipse cx="86" cy="74" rx="34" ry="24" fill={`url(#${uid}s)`} />
        <circle cx="78" cy="66" r="7" fill="#fff" opacity="0.7" />
      </g>
    </svg>
  );
}

type Active = "pulse" | "positions" | "how" | "about" | null;

export function Nav({ active }: { active?: Active }) {
  const link = (href: string, label: string, key: Active) => (
    <Link href={href} className={active === key ? "active" : ""}>
      {label}
    </Link>
  );
  return (
    <div className="nav">
      <div className="nav-inner">
        <Link href="/" className="logo">
          <LogoMark />
          NUGGET
        </Link>
        <nav className="nav-links">
          {link("/", "Pulse", "pulse")}
          {link("/positions", "Positions", "positions")}
          {link("/how-it-works", "How it works", "how")}
          {link("/about", "About", "about")}
        </nav>
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div className="footer-cols">
          <div className="footer-brand">
            <Link href="/" className="logo">
              <LogoMark />
              NUGGET
            </Link>
            <p>
              LP intelligence for Robinhood Chain. Small signals, big picture —
              what&apos;s happening to a pool and your position, every 5 minutes.
            </p>
          </div>
          <div className="footer-col">
            <h4>Product</h4>
            <Link href="/">Pulse</Link>
            <Link href="/positions">Positions</Link>
          </div>
          <div className="footer-col">
            <h4>Learn</h4>
            <Link href="/how-it-works">How it works</Link>
            <Link href="/about">About</Link>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer">
              GitHub
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          NUGGET reads pool activity — it does not recommend trades, rebalance,
          or hold funds. Velocity labels describe change in activity, not price
          predictions. Not financial advice. Not affiliated with Robinhood
          Markets, Inc.
        </div>
      </div>
    </footer>
  );
}

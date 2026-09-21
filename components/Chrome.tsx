"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// NUGGET logo — 3D glossy nugget + pulse waves (concept #6).
let _logoId = 0;
export function LogoMark({ size = 26 }: { size?: number }) {
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

const ICONS: Record<string, React.ReactNode> = {
  pulse: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  positions: (
    <>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </>
  ),
  how: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.2a3 3 0 0 1 5.6 1.3c0 2-2.8 2.5-2.8 4M12 17.5h.01" />
    </>
  ),
  about: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 7.5h.01" />
    </>
  ),
};

function isActive(pathname: string | null, key: string): boolean {
  if (!pathname) return false;
  if (key === "pulse") return pathname === "/" || pathname.startsWith("/pool");
  if (key === "positions") return pathname.startsWith("/positions");
  if (key === "how") return pathname.startsWith("/how-it-works");
  if (key === "about") return pathname.startsWith("/about");
  return false;
}

export function Sidebar() {
  const pathname = usePathname();
  const item = (href: string, label: string, key: string) => (
    <Link href={href} className={`nav-item ${isActive(pathname, key) ? "on" : ""}`}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        {ICONS[key]}
      </svg>
      <span>{label}</span>
    </Link>
  );
  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <LogoMark />
        <span className="wm">NUGGET</span>
      </Link>
      <nav className="side-nav">
        {item("/", "Pulse", "pulse")}
        {item("/positions", "Positions", "positions")}
        {item("/how-it-works", "How it works", "how")}
        {item("/about", "About", "about")}
      </nav>
      <div className="side-foot">
        <div className="bar" />
        <p>LP intelligence for Robinhood Chain</p>
      </div>
    </aside>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-links">
        <Link href="/how-it-works">How it works</Link>
        <Link href="/about">About</Link>
        <Link href="/positions">Positions</Link>
      </div>
      <p className="footer-note">
        NUGGET reads pool activity — it does not recommend trades, rebalance, or
        hold funds. Velocity labels describe change in activity, not price
        predictions. Not financial advice. Not affiliated with Robinhood Markets, Inc.
      </p>
    </footer>
  );
}

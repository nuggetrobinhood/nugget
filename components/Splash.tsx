"use client";

import { useEffect, useState } from "react";

// Playful intro: a nugget sizzling in a pan. Shows once per browser session.
export function Splash() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem("nugget.splash")) return;
      sessionStorage.setItem("nugget.splash", "1");
    } catch {
      /* private mode — just show it */
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 1900);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="splash" onClick={() => setShow(false)}>
      <div className="splash-scene">
        <svg viewBox="0 0 200 150" width="200" height="150" aria-hidden>
          <defs>
            <radialGradient id="sp-nug" cx="38%" cy="30%" r="80%">
              <stop offset="0" stopColor="#FFE49B" /><stop offset="0.45" stopColor="#F6B93B" /><stop offset="1" stopColor="#C67D14" />
            </radialGradient>
          </defs>
          {/* steam */}
          <g className="steam" fill="none" stroke="#8a95a5" strokeWidth="3" strokeLinecap="round" opacity="0.5">
            <path d="M80 44 q-6 -10 0 -20 q6 -10 0 -20" />
            <path d="M100 40 q-6 -10 0 -20 q6 -10 0 -20" />
            <path d="M120 44 q-6 -10 0 -20 q6 -10 0 -20" />
          </g>
          {/* nugget */}
          <g className="nug">
            <path d="M78 96 C74 72 96 60 114 66 C134 56 170 66 170 98 C184 106 180 132 160 138 C152 160 116 162 102 150 C74 152 64 124 78 96 Z" fill="url(#sp-nug)" />
            <ellipse cx="104" cy="86" rx="20" ry="13" fill="#fff" opacity="0.45" />
          </g>
          {/* pan */}
          <ellipse cx="120" cy="140" rx="66" ry="12" fill="#12100c" />
          <ellipse cx="120" cy="137" rx="66" ry="12" fill="#1c1912" stroke="#2a241a" strokeWidth="2" />
          <rect x="182" y="132" width="14" height="7" rx="3" fill="#2a241a" transform="rotate(-6 182 135)" />
        </svg>
        <div className="splash-text">Cooking nuggets<span className="dots"><i>.</i><i>.</i><i>.</i></span></div>
      </div>
    </div>
  );
}

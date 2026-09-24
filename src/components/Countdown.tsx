"use client";
import { useEffect, useState } from "react";

const R = 29;
const CIRC = 2 * Math.PI * R;

export function Countdown({ seconds, keySeed }: { seconds: number; keySeed: string | number }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds, keySeed]);

  const frac = seconds > 0 ? remaining / seconds : 0;
  const low = remaining <= 5;
  const stroke = low ? "var(--red)" : "var(--fg)";

  return (
    <div className="timer" role="timer" aria-label={`${remaining} seconds left`}>
      <svg viewBox="0 0 64 64" className="timer-ring">
        <circle cx="32" cy="32" r={R} className="timer-track" />
        <circle
          cx="32"
          cy="32"
          r={R}
          className="timer-progress"
          style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - frac), stroke }}
        />
      </svg>
      <span className="timer-num" style={{ color: stroke }}>
        {remaining}
      </span>
    </div>
  );
}

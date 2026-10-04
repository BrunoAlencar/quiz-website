"use client";
import { useEffect, useRef, useState } from "react";
import { playTick } from "@/lib/tickSound";

const R = 29;
const CIRC = 2 * Math.PI * R;

export function Countdown({ seconds, keySeed, sound = false }: {
  seconds: number; keySeed: string | number; sound?: boolean;
}) {
  const [remaining, setRemaining] = useState(seconds);
  // Read through a ref so muting mid-question doesn't restart the countdown.
  const soundRef = useRef(sound);
  soundRef.current = sound;
  useEffect(() => {
    setRemaining(seconds);
    let left = seconds;
    const t = setInterval(() => {
      if (left <= 0) return;
      left -= 1;
      setRemaining(left);
      if (left > 0 && soundRef.current) playTick(left <= 5);
    }, 1000);
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

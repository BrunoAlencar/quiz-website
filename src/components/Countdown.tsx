"use client";
import { useEffect, useState } from "react";

export function Countdown({ seconds, keySeed }: { seconds: number; keySeed: string | number }) {
  const [remaining, setRemaining] = useState(seconds);
  useEffect(() => {
    setRemaining(seconds);
    const t = setInterval(() => setRemaining((r) => (r > 0 ? r - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [seconds, keySeed]);
  return <div style={{ fontSize: 48, fontWeight: 700 }}>{remaining}</div>;
}

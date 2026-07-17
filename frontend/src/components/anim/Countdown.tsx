"use client";

import { useEffect, useState } from "react";

function format(msLeft: number) {
  if (msLeft <= 0) return "00:00:00:00";
  const totalSeconds = Math.floor(msLeft / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(days)}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/** Live-ticking DD:HH:MM:SS countdown to a deadline. The whole point of a
 *  commitment device is the clock — so it should visibly be running. */
export function Countdown({ deadline, className }: { deadline: Date; className?: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const msLeft = deadline.getTime() - now;
  const passed = msLeft <= 0;

  return (
    <span className={`font-mono tabular-nums ${passed ? "text-glow-red" : ""} ${className ?? ""}`}>
      {passed ? "DEADLINE PASSED" : format(msLeft)}
    </span>
  );
}

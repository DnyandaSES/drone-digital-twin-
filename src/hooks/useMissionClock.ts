/* ────────────────────────────────────────────────────────
   AEROTWIN — useMissionClock
   Returns a formatted UTC clock string updating every
   second:  "HH:MM:SSZ"
   ──────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";


function formatLocalTime(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Returns a live local clock string (HH:MM:SS), ticking every second.
 */
export function useMissionClock(): string {
  const [time, setTime] = useState(formatLocalTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatLocalTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}

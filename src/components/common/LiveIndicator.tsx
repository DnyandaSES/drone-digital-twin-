/* ────────────────────────────────────────────────────────
   AEROTWIN — LIVE INDICATOR
   6px breathing dot.
   • Cyan (breathing)  → live telemetry
   • Gray              → idle
   • Red               → connection lost
   ──────────────────────────────────────────────────────── */

import styles from "./LiveIndicator.module.css";


export type LiveStatus = "live" | "idle" | "lost";

interface LiveIndicatorProps {
  status?: LiveStatus;
  showText?: boolean;
  className?: string;
}

export default function LiveIndicator({
  status = "live",
  showText = true,
  className = "",
}: LiveIndicatorProps) {
  const statusClass =
    status === "live"
      ? styles.live
      : status === "lost"
        ? styles.lost
        : styles.idle;

  const labelText =
    status === "live" ? "LIVE" : status === "lost" ? "LOST" : "IDLE";

  return (
    <span className={`${styles.wrap} ${className}`}>
      <span
        className={`${styles.dot} ${statusClass}`}
        role="status"
        aria-label={
          status === "live"
            ? "Receiving telemetry"
            : status === "lost"
              ? "Connection lost"
              : "Idle"
        }
      />
      {showText && <span className={styles.text}>{labelText}</span>}
    </span>
  );
}

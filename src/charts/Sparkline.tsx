/* ────────────────────────────────────────────────────────
   AEROTWIN — SPARKLINE
   Tiny inline bar chart for signal strength / mini trends.
   ──────────────────────────────────────────────────────── */

import styles from "./Sparkline.module.css";


interface SparklineProps {
  /** Array of values (0–100 scale works best). */
  data: number[];

  /** Bar color — defaults to live cyan. */
  color?: string;

  /** Container height in px. */
  height?: number;
}

export default function Sparkline({
  data,
  color = "var(--accent-cyan)",
  height = 60,
}: SparklineProps) {
  return (
    <div className={styles.bars} style={{ height }} aria-hidden="true">
      {data.map((value, i) => (
        <div
          key={i}
          className={styles.bar}
          style={{
            height: `${Math.max(4, value)}%`,
            background: color,
          }}
        />
      ))}
    </div>
  );
}

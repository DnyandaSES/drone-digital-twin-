/* ────────────────────────────────────────────────────────
   AEROTWIN — GAUGE
   SVG semicircular arc gauge for engineering readouts.
   Used by BusVoltageGauge and BusCurrentGauge.
   ──────────────────────────────────────────────────────── */

import { memo } from "react";
import type { AlertSeverity } from "../types/telemetry";
import StatusChip from "../components/common/StatusChip";

import styles from "./Gauge.module.css";


interface GaugeProps {
  /** Current value. */
  value: number;

  /** Minimum scale value. */
  min: number;

  /** Maximum scale value. */
  max: number;

  /** Display unit (e.g. "V", "A"). */
  unit: string;

  /** Optional gauge label. */
  label?: string;

  /** Arc color — use design token CSS variable. */
  color?: string;

  /** Status severity for the badge below. */
  status?: AlertSeverity;
}

function Gauge({
  value,
  min,
  max,
  unit,
  label,
  color = "var(--accent-amber)",
  status = "nominal",
}: GaugeProps) {
  // Arc geometry
  const cx = 100;
  const cy = 70;
  const r = 55;
  const startAngle = Math.PI;          // 180° (left)
  const endAngle = 0;                  // 0° (right)
  const totalAngle = Math.PI;

  // Clamp value within range
  const clamped = Math.max(min, Math.min(max, value));
  const ratio = (clamped - min) / (max - min);
  const angle = startAngle - ratio * totalAngle;

  // Arc path (filled portion)
  const arcEnd = startAngle - ratio * totalAngle;

  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy - r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(arcEnd);
  const y2 = cy - r * Math.sin(arcEnd);

  const filledPath = `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`;

  // Background arc (full semicircle)
  const bgX1 = cx + r * Math.cos(startAngle);
  const bgY1 = cy - r * Math.sin(startAngle);
  const bgX2 = cx + r * Math.cos(endAngle);
  const bgY2 = cy - r * Math.sin(endAngle);
  const bgPath = `M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}`;

  // Needle endpoint
  const needleX = cx + (r - 8) * Math.cos(angle);
  const needleY = cy - (r - 8) * Math.sin(angle);

  return (
    <div className={styles.gauge}>
      <svg viewBox="0 0 200 102" className={styles.svg}>
        {/* Background arc */}
        <path
          d={bgPath}
          fill="none"
          stroke="var(--line-rivet)"
          strokeWidth="7"
          strokeLinecap="round"
        />

        {/* Filled arc */}
        {ratio > 0.005 && (
          <path
            d={filledPath}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeLinecap="round"
          />
        )}

        {/* Needle */}
        <line
          x1={cx}
          y1={cy}
          x2={needleX}
          y2={needleY}
          stroke="var(--text-canopy)"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3" fill="var(--text-canopy)" />

        {/* Min / Max labels */}
        <text
          x={cx - r - 4}
          y={cy + 12}
          className={styles.scaleLabel}
          textAnchor="middle"
        >
          {min}
        </text>
        <text
          x={cx + r + 4}
          y={cy + 12}
          className={styles.scaleLabel}
          textAnchor="middle"
        >
          {max}
        </text>

        {/* Center value below needle pivot */}
        <text x={cx} y={cy + 22} className={styles.valueText} textAnchor="middle">
          {value.toFixed(1)} {unit}
        </text>
      </svg>

      <div className={styles.footer}>
        {label && <span className={styles.label}>{label}</span>}
        <StatusChip status={status} />
      </div>
    </div>
  );
}

export default memo(Gauge);

/* ────────────────────────────────────────────────────────
   AEROTWIN — ATTITUDE RING
   Bespoke SVG artificial-horizon gauge.
   Signature AeroTwin visual element — not replaceable
   by a generic chart library.
   ──────────────────────────────────────────────────────── */

import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";

import styles from "./AttitudeRing.module.css";


function AttitudeRing() {
  const { roll, pitch, yaw } = useTelemetryStore((s) => s.current.flight);

  return (
    <div className={styles.body}>
      {/* ── SVG Gauge ──────────────────────────────────── */}
      <svg
        viewBox="0 0 140 140"
        className={styles.ring}
        role="img"
        aria-label={`Attitude: Roll ${roll.toFixed(1)}°, Pitch ${pitch.toFixed(1)}°, Yaw ${yaw.toFixed(0)}°`}
      >
        <defs>
          <clipPath id="att-ring-clip">
            <circle cx="70" cy="70" r="56" />
          </clipPath>
        </defs>

        {/* Background disc */}
        <circle cx="70" cy="70" r="58" fill="var(--bg-panel-raised)" />

        {/* Fixed outer clipping group */}
        <g clipPath="url(#att-ring-clip)">
          {/* Horizon group — rotates with roll, translates with pitch */}
          <g
            style={{
              transform: `rotate(${roll}deg) translateY(${pitch * -3}px)`,
              transformOrigin: "70px 70px",
            }}
          >
            {/* Ground (amber, below horizon) */}
            <rect
              x="-40" y="70"
              width="220" height="150"
              fill="var(--accent-amber)"
              opacity="0.25"
            />
            {/* Horizon line */}
            <line
              x1="-40" y1="70" x2="180" y2="70"
              stroke="var(--accent-amber)"
              strokeWidth="2"
            />

            {/* Pitch ladder marks */}
            {[-20, -10, 10, 20].map((deg) => (
              <line
                key={deg}
                x1="50" y1={70 - deg * 2}
                x2="90" y2={70 - deg * 2}
                stroke="var(--accent-amber)"
                strokeWidth="0.8"
                opacity="0.4"
              />
            ))}
          </g>
        </g>

        {/* Ring border */}
        <circle
          cx="70" cy="70" r="58"
          fill="none"
          stroke="var(--line-rivet)"
          strokeWidth="1.5"
        />

        {/* Aircraft reference (cyan) */}
        <line x1="42" y1="70" x2="60" y2="70" stroke="var(--accent-cyan)" strokeWidth="2" />
        <line x1="80" y1="70" x2="98" y2="70" stroke="var(--accent-cyan)" strokeWidth="2" />
        <circle cx="70" cy="70" r="2.5" fill="var(--accent-cyan)" />

        {/* Top/bottom reference ticks */}
        <line x1="70" y1="14" x2="70" y2="20" stroke="var(--text-instrument)" strokeWidth="1.5" />
      </svg>

      {/* ── Readout ────────────────────────────────────── */}
      <div className={styles.readout}>
        <div className={styles.readoutRow}>
          <span className={styles.readoutLabel}>ROLL</span>
          <span className={styles.readoutValue} data-live="true">
            {roll.toFixed(1)}°
          </span>
        </div>
        <div className={styles.readoutRow}>
          <span className={styles.readoutLabel}>PITCH</span>
          <span className={styles.readoutValue} data-live="true">
            {pitch.toFixed(1)}°
          </span>
        </div>
        <div className={styles.readoutRow}>
          <span className={styles.readoutLabel}>YAW</span>
          <span className={styles.readoutValue} data-live="true">
            {yaw.toFixed(0)}°
          </span>
        </div>
      </div>
    </div>
  );
}

export default memo(AttitudeRing);

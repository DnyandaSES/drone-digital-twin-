/* ────────────────────────────────────────────────────────
   AEROTWIN — INSTRUMENT CARD
   The fundamental panel component: flat surface, 1px
   rivet border, optional live indicator and corner
   bracket framing.
   ──────────────────────────────────────────────────────── */

import type { ReactNode } from "react";

import CornerBracket from "./CornerBracket";
import LiveIndicator, { type LiveStatus } from "./LiveIndicator";

import styles from "./InstrumentCard.module.css";


interface InstrumentCardProps {
  /** Placard label, e.g. "ALT · M" */
  label?: string;

  /** Show a LiveIndicator dot. */
  live?: LiveStatus;

  /** Show corner-bracket framing for live/focused panels. */
  bracketFrame?: boolean;

  /** Brackets turn red (alert state). */
  alert?: boolean;

  /** Optional icon element to the right of the label. */
  labelRight?: ReactNode;

  /** Additional CSS class. */
  className?: string;

  children: ReactNode;
}

export default function InstrumentCard({
  label,
  live,
  bracketFrame = false,
  alert = false,
  labelRight,
  className = "",
  children,
}: InstrumentCardProps) {
  return (
    <div className={`${styles.card} ${className}`}>
      {bracketFrame && <CornerBracket alert={alert} />}

      {label && (
        <div className={styles.label}>
          <span>{label}</span>

          <span className={styles.labelRight}>
            {labelRight}
            {live && <LiveIndicator status={live} />}
          </span>
        </div>
      )}

      <div className={styles.body}>{children}</div>
    </div>
  );
}

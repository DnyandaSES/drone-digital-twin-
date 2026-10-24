/* ────────────────────────────────────────────────────────
   AEROTWIN — STAT CARD
   Compact large-number instrument readout.
   Used for ALT, SPD, BATT%, FLIGHT TIME, etc.
   ──────────────────────────────────────────────────────── */

import { memo, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { useSmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./StatCard.module.css";


interface StatCardProps {
  /** Placard label, e.g. "ALT · M" */
  label: string;

  /** Large numeric value or formatted string. */
  value: string | number;

  /** Number of decimal places when value is a number. */
  decimals?: number;

  /** Unit suffix, e.g. "m", "m/s", "%" */
  unit?: string;

  /** Optional Lucide icon component. */
  icon?: LucideIcon;

  /** Optional sub-content below the value (e.g. battery bar). */
  sub?: ReactNode;
}

function NumericValue({ num, decimals }: { num: number; decimals?: number }) {
  const smooth = useSmoothNumber(num, { decimals: decimals ?? (Number.isInteger(num) ? 0 : 1) });
  return <>{smooth}</>;
}

function StatCard({
  label,
  value,
  decimals,
  unit,
  icon: Icon,
  sub,
}: StatCardProps) {
  const isNumber = typeof value === "number";

  return (
    <div className={styles.card}>
      <div className={styles.label}>
        {Icon && <Icon size={14} strokeWidth={1.6} aria-hidden="true" />}
        <span>{label}</span>
      </div>

      <div className={styles.value} data-live="true">
        {isNumber ? <NumericValue num={value} decimals={decimals} /> : value}
        {unit && <span className={styles.unit}>{unit}</span>}
      </div>

      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}

export default memo(StatCard);

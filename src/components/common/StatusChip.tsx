/* ────────────────────────────────────────────────────────
   AEROTWIN — STATUS CHIP
   Shape + color indicator:
   ✓ NOMINAL   ▲ CAUTION   ✕ CRITICAL
   Never relies on color alone (accessibility).
   ──────────────────────────────────────────────────────── */

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { AlertSeverity } from "../../types/telemetry";

import styles from "./StatusChip.module.css";


const ICONS = {
  nominal: CheckCircle2,
  caution: AlertTriangle,
  critical: XCircle,
};

const DEFAULT_LABELS: Record<AlertSeverity, string> = {
  nominal:  "NOMINAL",
  caution:  "CAUTION",
  critical: "CRITICAL",
};


interface StatusChipProps {
  status: AlertSeverity;
  /** Custom label; defaults to NOMINAL / CAUTION / CRITICAL. */
  label?: string;
  className?: string;
}

export default function StatusChip({
  status,
  label,
  className = "",
}: StatusChipProps) {
  const Icon = ICONS[status];

  return (
    <span
      className={`${styles.chip} ${styles[status]} ${className}`}
      role="status"
    >
      <Icon size={12} strokeWidth={1.8} className={styles.icon} aria-hidden="true" />
      <span>{label ?? DEFAULT_LABELS[status]}</span>
    </span>
  );
}

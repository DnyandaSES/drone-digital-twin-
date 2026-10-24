/* ────────────────────────────────────────────────────────
   AEROTWIN — SIGNAL PANEL
   RSSI display with cyan signal bars and status chips.
   ──────────────────────────────────────────────────────── */

import { useMemo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import { SIGNAL_THRESHOLDS, getSeverityBelow } from "../../lib/thresholds";

import Sparkline from "../../charts/Sparkline";
import StatusChip from "../common/StatusChip";

import styles from "./SignalPanel.module.css";


export default function SignalPanel() {
  const rssi = useTelemetryStore((s) => s.current.signal.rssi);
  const rssiHistory = useTelemetryStore((s) => s.history.rssi);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);

  const status = getSeverityBelow(
    rssi,
    SIGNAL_THRESHOLDS.rssi.caution,
    SIGNAL_THRESHOLDS.rssi.critical,
  );

  // Normalize RSSI (-90…-20) to 0–100 for sparkline bars
  const barData = useMemo(
    () =>
      rssiHistory.length > 0
        ? rssiHistory.slice(-16).map((p) => {
            const normalized = ((p.value + 90) / 70) * 100;
            return Math.max(5, Math.min(100, normalized));
          })
        : Array.from({ length: 16 }, () => 50),
    [rssiHistory],
  );

  return (
    <div className={styles.panel}>
      <div className={styles.valueRow}>
        <span className={styles.rssiValue} data-live="true">
          {rssi.toFixed(0)}
        </span>
        <span className={styles.rssiUnit}>dBm</span>
        <span className={styles.connLabel}>
          {connectionStatus === "connected" ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>

      <div className={styles.barsWrap}>
        <Sparkline data={barData} height={60} />
      </div>

      <div className={styles.chips}>
        <StatusChip status={status} />
      </div>
    </div>
  );
}

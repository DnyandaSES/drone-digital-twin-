/* ────────────────────────────────────────────────────────
   AEROTWIN — ALERTS SUMMARY
   Compact list of active/recent alerts.
   ──────────────────────────────────────────────────────── */

import { useMemo, memo } from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useTelemetryStore } from "../../store/telemetryStore";
import {
  BATTERY_THRESHOLDS,
  FUEL_CELL_THRESHOLDS,
  getSeverityBelow,
  getSeverityAbove,
} from "../../lib/thresholds";
import type { AlertSeverity } from "../../types/telemetry";

import styles from "./AlertsSummary.module.css";


const SEVERITY_ICONS = {
  nominal:  CheckCircle2,
  caution:  AlertTriangle,
  critical: XCircle,
};

interface DisplayAlert {
  id: string;
  severity: AlertSeverity;
  message: string;
  detail?: string;
}

function AlertsSummary() {
  const battery = useTelemetryStore((s) => s.current.battery);
  const fuelCell = useTelemetryStore((s) => s.current.fuelCell);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);

  // Derive alerts from current telemetry
  const alerts = useMemo<DisplayAlert[]>(() => {
    const list: DisplayAlert[] = [];

    // Battery
    const battSev = getSeverityBelow(
      battery.percentage,
      BATTERY_THRESHOLDS.percentage.caution,
      BATTERY_THRESHOLDS.percentage.critical,
    );
    if (battSev !== "nominal") {
      list.push({
        id: "batt-pct",
        severity: battSev,
        message: "Battery level low",
        detail: `${battery.percentage.toFixed(0)}%`,
      });
    }

    const battTempSev = getSeverityAbove(
      battery.temperature,
      BATTERY_THRESHOLDS.temperature.caution,
      BATTERY_THRESHOLDS.temperature.critical,
    );
    if (battTempSev !== "nominal") {
      list.push({
        id: "batt-temp",
        severity: battTempSev,
        message: "Battery temperature high",
        detail: `${battery.temperature.toFixed(0)} °C`,
      });
    }

    // Fuel cell
    const fcTempSev = getSeverityAbove(
      fuelCell.temperature,
      FUEL_CELL_THRESHOLDS.temperature.caution,
      FUEL_CELL_THRESHOLDS.temperature.critical,
    );
    if (fcTempSev !== "nominal") {
      list.push({
        id: "fc-temp",
        severity: fcTempSev,
        message: "Fuel cell temperature high",
        detail: `${fuelCell.temperature.toFixed(0)} °C`,
      });
    }

    // Connection
    if (connectionStatus !== "connected") {
      list.push({
        id: "link",
        severity: "critical",
        message: "Telemetry link lost",
      });
    }

    return list;
  }, [battery, fuelCell, connectionStatus]);

  const allNominal = alerts.length === 0;

  return (
    <div className={styles.panel}>
      {allNominal && (
        <div className={`${styles.alertRow} ${styles.nominal}`}>
          <CheckCircle2 size={13} strokeWidth={1.8} className={styles.icon} />
          <span>All systems normal</span>
        </div>
      )}

      {alerts.map((alert) => {
        const Icon = SEVERITY_ICONS[alert.severity];
        return (
          <div
            key={alert.id}
            className={`${styles.alertRow} ${styles[alert.severity]}`}
          >
            <Icon size={13} strokeWidth={1.8} className={styles.icon} />
            <span className={styles.message}>{alert.message}</span>
            {alert.detail && (
              <span className={styles.detail}>{alert.detail}</span>
            )}
          </div>
        );
      })}

      {/* Always show some baseline items when nominal */}
      {allNominal && (
        <>
          <div className={`${styles.alertRow} ${styles.nominal}`}>
            <CheckCircle2 size={13} strokeWidth={1.8} className={styles.icon} />
            <span className={styles.message}>Fuel cell temperature normal</span>
            <span className={styles.detail}>{fuelCell.temperature.toFixed(0)} °C</span>
          </div>
          <div className={`${styles.alertRow} ${styles.nominal}`}>
            <CheckCircle2 size={13} strokeWidth={1.8} className={styles.icon} />
            <span className={styles.message}>Battery temperature normal</span>
            <span className={styles.detail}>{battery.temperature.toFixed(0)} °C</span>
          </div>
          <div className={`${styles.alertRow} ${styles.nominal}`}>
            <CheckCircle2 size={13} strokeWidth={1.8} className={styles.icon} />
            <span className={styles.message}>No active faults</span>
          </div>
        </>
      )}
    </div>
  );
}

export default memo(AlertsSummary);

/* ────────────────────────────────────────────────────────
   AEROTWIN — SYSTEM STATUS STRIP
   Row of status items for Battery, Fuel Cell, DC Bus,
   and Telemetry link.
   ──────────────────────────────────────────────────────── */

import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import {
  BATTERY_THRESHOLDS,
  FUEL_CELL_THRESHOLDS,
  getSeverityBelow,
  getSeverityAbove,
} from "../../lib/thresholds";
import type { AlertSeverity } from "../../types/telemetry";
import StatusChip from "../common/StatusChip";

import styles from "./SystemStatusStrip.module.css";


interface SystemItem {
  label: string;
  voltage?: string;
  current?: string;
  contribution?: string;
  severity: AlertSeverity;
  statusLabel: string;
}

function SystemStatusStrip() {
  const battery = useTelemetryStore((s) => s.current.battery);
  const fuelCell = useTelemetryStore((s) => s.current.fuelCell);
  const dcBus = useTelemetryStore((s) => s.current.dcBus);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);

  const batteryPower = battery.voltage * battery.current;
  const fuelCellPower = fuelCell.voltage * fuelCell.current;
  const totalPower = batteryPower + fuelCellPower;
  const batteryContrib = totalPower > 0 ? ((batteryPower / totalPower) * 100).toFixed(0) : "0";
  const fuelCellContrib = totalPower > 0 ? ((fuelCellPower / totalPower) * 100).toFixed(0) : "0";

  const battSeverity = getSeverityBelow(
    battery.percentage,
    BATTERY_THRESHOLDS.percentage.caution,
    BATTERY_THRESHOLDS.percentage.critical,
  );

  const fcSeverity = getSeverityAbove(
    fuelCell.temperature,
    FUEL_CELL_THRESHOLDS.temperature.caution,
    FUEL_CELL_THRESHOLDS.temperature.critical,
  );

  const linkSeverity: AlertSeverity =
    connectionStatus === "connected" ? "nominal" : "critical";

  const items: SystemItem[] = [
    {
      label: "Battery (LiPo)",
      voltage: `${battery.voltage.toFixed(1)} V`,
      current: `${battery.current.toFixed(1)} A`,
      contribution: `${batteryContrib} %`,
      severity: battSeverity,
      statusLabel: battery.current > 0 ? "DISCHARGING" : "IDLE",
    },
    {
      label: "Fuel Cell (H₂)",
      voltage: `${fuelCell.voltage.toFixed(1)} V`,
      current: `${fuelCell.current.toFixed(1)} A`,
      contribution: `${fuelCellContrib} %`,
      severity: fcSeverity,
      statusLabel: "SUPPLYING",
    },
  ];

  return (
    <div className={styles.strip}>
      {items.map((item) => (
        <div key={item.label} className={styles.row}>
          <div className={styles.rowLeft}>
            <span
              className={styles.icon}
              style={{
                color:
                  item.label.includes("Battery")
                    ? "var(--chart-battery)"
                    : "var(--chart-fuel-cell)",
              }}
            >
              {item.label.includes("Battery") ? "⚡" : "⛽"}
            </span>
            <span className={styles.itemLabel}>{item.label}</span>
          </div>

          <div className={styles.rowValues}>
            <div className={styles.valGroup}>
              <span className={styles.val} data-live="true">{item.voltage}</span>
              <span className={styles.valLabel}>VOLTAGE</span>
            </div>
            <div className={styles.valGroup}>
              <span className={styles.val} data-live="true">{item.current}</span>
              <span className={styles.valLabel}>CURRENT</span>
            </div>
            <div className={styles.valGroup}>
              <span className={styles.val} data-live="true">{item.contribution}</span>
              <span className={styles.valLabel}>CONTRIB</span>
            </div>
          </div>

          <div className={styles.rowRight}>
            <StatusChip status={item.severity} label={item.statusLabel} />
          </div>
        </div>
      ))}

      {/* Extra rows for DC Bus & Link */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryItem}>
          <span className={styles.summaryIcon}>⚡</span>
          <span className={styles.summaryLabel}>Total Power</span>
          <span className={styles.summaryValue} data-live="true">{totalPower.toFixed(0)} W</span>
        </div>
        <div className={styles.summaryItem}>
          <span className={styles.summaryIcon}>🔋</span>
          <span className={styles.summaryLabel}>DC Bus</span>
          <span className={styles.summaryValue} data-live="true">{dcBus.voltage.toFixed(0)} V</span>
        </div>
        <div className={styles.summaryItem}>
          <StatusChip status={linkSeverity} label={connectionStatus === "connected" ? "LINK OK" : "NO LINK"} />
        </div>
      </div>
    </div>
  );
}

export default memo(SystemStatusStrip);

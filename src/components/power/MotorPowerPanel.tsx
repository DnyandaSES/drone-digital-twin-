import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import TelemetryLineChart from "../../charts/TelemetryLineChart";
import { SmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./PowerPanel.module.css";


function MotorPowerPanel() {
  const current = useTelemetryStore((s) => s.current);
  const motorHistory = useTelemetryStore((s) => s.history.motorPower);

  // Live motor power (Watts)
  const rawMotor = current.motor as unknown;
  const motorPower =
    typeof rawMotor === "number"
      ? rawMotor
      : current.motor?.power ??
        (current.battery.voltage * current.battery.current + current.fuelCell.voltage * current.fuelCell.current);

  const batteryPower = current.battery.voltage * current.battery.current;
  const fuelCellPower = current.fuelCell.voltage * current.fuelCell.current;

  return (
    <div className={styles.panel}>
      {/* Header with legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--accent-cyan)" }} />
          Motor Power (W)
        </span>
      </div>

      {/* Chart */}
      <div className={styles.charts}>
        <TelemetryLineChart
          data={motorHistory}
          color="var(--accent-cyan)"
          unit="W"
          height={120}
        />
      </div>

      {/* Readout footer */}
      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={motorPower} decimals={0} unit="W" />
          </span>
          <span className={styles.readoutLabel}>MOTOR POWER</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={batteryPower} decimals={0} unit="W" />
          </span>
          <span className={styles.readoutLabel}>BATT DRAW</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={fuelCellPower} decimals={0} unit="W" />
          </span>
          <span className={styles.readoutLabel}>FC DRAW</span>
        </div>
      </div>
    </div>
  );
}

export default memo(MotorPowerPanel);

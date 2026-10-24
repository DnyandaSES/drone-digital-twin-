import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import TelemetryLineChart from "../../charts/TelemetryLineChart";
import { SmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./PowerPanel.module.css";


function BatteryPanel() {
  const battery = useTelemetryStore((s) => s.current.battery);
  const voltageHistory = useTelemetryStore((s) => s.history.batteryVoltage);
  const currentHistory = useTelemetryStore((s) => s.history.batteryCurrent);

  const power = battery.voltage * battery.current;

  return (
    <div className={styles.panel}>
      {/* Header with legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--chart-battery)" }} />
          Voltage (V)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--status-caution)" }} />
          Current (A)
        </span>
      </div>

      {/* Charts */}
      <div className={styles.charts}>
        <TelemetryLineChart
          data={voltageHistory}
          color="var(--chart-battery)"
          unit="V"
          height={100}
        />
        <TelemetryLineChart
          data={currentHistory}
          color="var(--status-caution)"
          unit="A"
          height={100}
        />
      </div>

      {/* Footer readout */}
      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={battery.voltage} decimals={1} unit="V" />
          </span>
          <span className={styles.readoutLabel}>VOLTAGE</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={battery.current} decimals={1} unit="A" />
          </span>
          <span className={styles.readoutLabel}>CURRENT</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={power} decimals={0} unit="W" />
          </span>
          <span className={styles.readoutLabel}>POWER</span>
        </div>
      </div>
    </div>
  );
}

export default memo(BatteryPanel);

import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import TelemetryLineChart from "../../charts/TelemetryLineChart";
import { SmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./PowerPanel.module.css";


function FuelCellPanel() {
  const fuelCell = useTelemetryStore((s) => s.current.fuelCell);
  const voltageHistory = useTelemetryStore((s) => s.history.fuelCellVoltage);
  const currentHistory = useTelemetryStore((s) => s.history.fuelCellCurrent);

  const power = fuelCell.voltage * fuelCell.current;

  return (
    <div className={styles.panel}>
      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--chart-fuel-cell)" }} />
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
          color="var(--chart-fuel-cell)"
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

      {/* Footer */}
      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={fuelCell.voltage} decimals={1} unit="V" />
          </span>
          <span className={styles.readoutLabel}>VOLTAGE</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={fuelCell.current} decimals={1} unit="A" />
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

export default memo(FuelCellPanel);

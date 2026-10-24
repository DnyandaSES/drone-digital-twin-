import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import TelemetryLineChart from "../../charts/TelemetryLineChart";
import { SmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./PowerPanel.module.css";


function DcBusPanel() {
  const dcBus = useTelemetryStore((s) => s.current.dcBus);
  const voltageHistory = useTelemetryStore((s) => s.history.dcBusVoltage);
  const currentHistory = useTelemetryStore((s) => s.history.dcBusCurrent);

  const power = dcBus.voltage * dcBus.current;

  return (
    <div className={styles.panel}>
      {/* Legend */}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--chart-dc-bus)" }} />
          Voltage (V)
        </span>
        <span className={styles.legendItem}>
          <span className={styles.legendDot} style={{ background: "var(--status-critical)" }} />
          Current (A)
        </span>
      </div>

      {/* Charts */}
      <div className={styles.charts}>
        <TelemetryLineChart
          data={voltageHistory}
          color="var(--chart-dc-bus)"
          unit="V"
          height={100}
        />
        <TelemetryLineChart
          data={currentHistory}
          color="var(--status-critical)"
          unit="A"
          height={100}
        />
      </div>

      {/* Footer */}
      <div className={styles.readout}>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={dcBus.voltage} decimals={1} unit="V" />
          </span>
          <span className={styles.readoutLabel}>VOLTAGE</span>
        </div>
        <div className={styles.readoutItem}>
          <span className={styles.readoutValue} data-live="true">
            <SmoothNumber value={dcBus.current} decimals={1} unit="A" />
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

export default memo(DcBusPanel);

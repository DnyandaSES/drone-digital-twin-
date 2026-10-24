import { memo } from "react";
import { useTelemetryStore } from "../../store/telemetryStore";
import { SmoothNumber } from "../../hooks/useSmoothNumber";

import styles from "./PowerContribution.module.css";


function PowerContribution() {
  const battery = useTelemetryStore((s) => s.current.battery);
  const fuelCell = useTelemetryStore((s) => s.current.fuelCell);

  const batteryPower = battery.voltage * battery.current;
  const fuelCellPower = fuelCell.voltage * fuelCell.current;
  const totalPower = batteryPower + fuelCellPower;

  const batteryPct = totalPower > 0 ? (batteryPower / totalPower) * 100 : 50;
  const fuelCellPct = totalPower > 0 ? (fuelCellPower / totalPower) * 100 : 50;

  const dominant = batteryPct > fuelCellPct ? "BATTERY" : "FUEL CELL";

  return (
    <div className={styles.panel}>
      {/* Labels */}
      <div className={styles.labels}>
        <div className={styles.source}>
          <span className={styles.sourceLabel}>Battery</span>
          <span className={styles.sourceValue} data-live="true">
            <SmoothNumber value={batteryPct} decimals={0} />
            <span className={styles.unit}>%</span>
          </span>
        </div>
        <div className={styles.source} style={{ textAlign: "right" }}>
          <span className={styles.sourceLabel}>Fuel Cell</span>
          <span className={styles.sourceValue} data-live="true">
            <SmoothNumber value={fuelCellPct} decimals={0} />
            <span className={styles.unit}>%</span>
          </span>
        </div>
      </div>

      {/* Horizontal bar container with pointer */}
      <div className={styles.barContainer}>
        {/* Pointer arrow pointing to junction from above */}
        <div
          className={styles.pointerWrap}
          style={{ left: `${batteryPct}%` }}
          aria-hidden="true"
        >
          <svg className={styles.pointerIcon} width="12" height="8" viewBox="0 0 12 8">
            <path d="M 0 0 L 12 0 L 6 8 Z" fill="var(--text-canopy)" />
          </svg>
        </div>

        <div className={styles.bar}>
          <div
            className={styles.barBattery}
            style={{ width: `${batteryPct}%` }}
            aria-label={`Battery: ${batteryPct.toFixed(0)}%`}
          />
          <div
            className={styles.barFuelCell}
            style={{ width: `${fuelCellPct}%` }}
            aria-label={`Fuel Cell: ${fuelCellPct.toFixed(0)}%`}
          />
        </div>
      </div>

      {/* Dominant source */}
      <div className={styles.dominant}>
        DOMINANT SOURCE: <strong>{dominant}</strong>
      </div>

      {/* Power values */}
      <div className={styles.powers}>
        <div className={styles.powerItem}>
          <span className={styles.powerValue} data-live="true">
            <SmoothNumber value={batteryPower} decimals={0} unit="W" />
          </span>
          <span className={styles.powerLabel}>BATT POWER</span>
        </div>
        <div className={styles.powerItem}>
          <span className={styles.powerValue} data-live="true">
            <SmoothNumber value={fuelCellPower} decimals={0} unit="W" />
          </span>
          <span className={styles.powerLabel}>FC POWER</span>
        </div>
        <div className={styles.powerItem}>
          <span className={styles.powerValue} data-live="true">
            <SmoothNumber value={totalPower} decimals={0} unit="W" />
          </span>
          <span className={styles.powerLabel}>TOTAL</span>
        </div>
      </div>
    </div>
  );
}

export default memo(PowerContribution);

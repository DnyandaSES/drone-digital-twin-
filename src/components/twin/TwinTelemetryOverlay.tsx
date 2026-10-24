/* ────────────────────────────────────────────────────────
   AEROTWIN — TWIN TELEMETRY OVERLAY
   HUD-style readouts positioned around the viewport.
   ──────────────────────────────────────────────────────── */

import { useTelemetryStore } from "../../store/telemetryStore";
import styles from "./TwinTelemetryOverlay.module.css";


export default function TwinTelemetryOverlay() {
  const flight = useTelemetryStore((s) => s.current.flight);
  const batt   = useTelemetryStore((s) => s.current.battery);
  const signal = useTelemetryStore((s) => s.current.signal);
  const motor  = useTelemetryStore((s) => s.current.motor);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");
  const throttle = useTelemetryStore((s) => s.current.masterPcb?.throttle ?? 0);
  const valveOpen = useTelemetryStore((s) => s.current.masterPcb?.valveOpen ?? false);

  return (
    <>
      {/* ── Left: Orientation & PCB Actuators ───────────── */}
      <div className={styles.left}>
        <div className={styles.readout}>
          <span className={styles.label}>ROLL</span>
          <span className={styles.value}>{flight.roll.toFixed(1)}°</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>PITCH</span>
          <span className={styles.value}>{flight.pitch.toFixed(1)}°</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>YAW</span>
          <span className={styles.value}>{flight.yaw.toFixed(0)}°</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>THR</span>
          <span className={styles.value} style={{ color: "var(--accent-cyan, #4FD8E0)" }}>
            {throttle}%
          </span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>VALVE</span>
          <span
            className={styles.value}
            style={{ color: valveOpen ? "#4ADE80" : "#94A3B8" }}
          >
            {valveOpen ? "OPEN" : "CLOSED"}
          </span>
        </div>
      </div>

      {/* ── Right: Flight Data ─────────────────────────── */}
      <div className={styles.right}>
        <div className={styles.readout}>
          <span className={styles.label}>ALT</span>
          <span className={styles.value}>{flight.altitude.toFixed(1)} m</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>SPD</span>
          <span className={styles.value}>{flight.speed.toFixed(1)} m/s</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>BAT</span>
          <span className={styles.value}>{batt.percentage.toFixed(0)} %</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>PWR</span>
          <span className={styles.value}>{(motor?.power ?? 0).toFixed(0)} W</span>
        </div>
        <div className={styles.readout}>
          <span className={styles.label}>RSSI</span>
          <span className={styles.value}>{signal.rssi} dBm</span>
        </div>
      </div>

      {/* ── Status badge ───────────────────────────────── */}
      <div className={`${styles.statusBadge} ${connected ? styles.live : styles.offline}`}>
        <span className={styles.dot} />
        {connected ? "LIVE" : "NO SIGNAL"}
      </div>
    </>
  );
}

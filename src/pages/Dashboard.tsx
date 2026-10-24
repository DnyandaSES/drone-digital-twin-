/* ────────────────────────────────────────────────────────
   AEROTWIN — DASHBOARD PAGE
   Assembles all flight, power, and system panels into
   a responsive instrument-panel grid.
   ──────────────────────────────────────────────────────── */

import { useMemo } from "react";
import {
  Mountain,
  Gauge as GaugeIcon,
  Battery,
  Flame,
  Clock,
  Zap,
  WifiOff,
} from "lucide-react";

import { useTelemetryStore } from "../store/telemetryStore";

/* ── Common ────────────────────────────────────────────── */
import StatCard from "../components/common/StatCard";
import InstrumentCard from "../components/common/InstrumentCard";

/* ── Flight ────────────────────────────────────────────── */
import AttitudeRing from "../components/flight/AttitudeRing";
import AltitudeChart from "../components/flight/AltitudeChart";

/* ── Power ─────────────────────────────────────────────── */
import BatteryPanel from "../components/power/BatteryPanel";
import FuelCellPanel from "../components/power/FuelCellPanel";
import DcBusPanel from "../components/power/DcBusPanel";
import PowerContribution from "../components/power/PowerContribution";
import MotorPowerPanel from "../components/power/MotorPowerPanel";

/* ── System ────────────────────────────────────────────── */
import SystemStatusStrip from "../components/system/SystemStatusStrip";
import AlertsSummary from "../components/system/AlertsSummary";

/* ── Master PCB Hardware & Throttle ──────────────────────── */
import MasterPcbControlPanel from "../components/pcb/MasterPcbControlPanel";

import styles from "./Dashboard.module.css";


export default function Dashboard() {
  const altitude = useTelemetryStore((s) => s.current.flight.altitude);
  const speed = useTelemetryStore((s) => s.current.flight.speed);
  const battPct = useTelemetryStore((s) => s.current.battery.percentage);
  const tankPct = useTelemetryStore((s) => s.current.fuelCell.tankPercentage);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);
  const missionStart = useTelemetryStore((s) => s.missionStartTime);

  const liveStatus = connectionStatus === "connected" ? "live" as const : "lost" as const;

  // Mission elapsed time
  const missionElapsed = useMemo(() => {
    if (connectionStatus !== "connected") {
      return "00:00:00";
    }
    const elapsed = Math.floor((Date.now() - missionStart) / 1000);
    const h = String(Math.floor(elapsed / 3600)).padStart(2, "0");
    const m = String(Math.floor((elapsed % 3600) / 60)).padStart(2, "0");
    const s = String(elapsed % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
  }, [missionStart, connectionStatus]);

  // Battery bar for StatCard
  const batteryBar = (
    <div className={styles.battBar}>
      <div
        className={styles.battFill}
        style={{
          width: `${battPct}%`,
          background:
            battPct <= 15
              ? "var(--status-critical)"
              : battPct <= 30
                ? "var(--status-caution)"
                : "var(--status-nominal)",
        }}
      />
    </div>
  );

  // H2 Fuel Tank bar for StatCard
  const h2TankBar = (
    <div className={styles.battBar}>
      <div
        className={styles.battFill}
        style={{
          width: `${tankPct}%`,
          background:
            tankPct <= 15
              ? "var(--status-critical)"
              : tankPct <= 30
                ? "var(--status-caution)"
                : "var(--status-nominal)",
        }}
      />
    </div>
  );

  return (
    <div className={`${styles.dashboard} ${connectionStatus !== "connected" ? styles.noScroll : ""}`}>

      {/* ── Signal Lost Backdrop Overlay ───────────────────── */}
      {connectionStatus !== "connected" && (
        <div className={styles.noSignalOverlay}>
          <div className={styles.noSignalCard}>
            <div className={styles.noSignalTitle}>
              <WifiOff size={20} strokeWidth={2} />
              NO TELEMETRY SIGNAL
            </div>
            <div className={styles.noSignalDesc}>
              Telemetry stream lost or ESP32 ground unit offline. Ground control station is listening for UDP telemetry broadcast on port <strong>8888</strong>.
            </div>
            <div className={styles.noSignalBadge}>
              SEARCHING FOR UDP BROADCAST (:8888)...
            </div>
          </div>
        </div>
      )}

      {/* ════════════════ ROW 1 — STAT CARDS ════════════════ */}
      <section className={styles.statRow}>
        <StatCard
          label="ALT · M"
          value={altitude}
          decimals={1}
          unit="m"
          icon={Mountain}
        />
        <StatCard
          label="SPD · M/S"
          value={speed}
          decimals={1}
          unit="m/s"
          icon={GaugeIcon}
        />
        <StatCard
          label="BATT · %"
          value={battPct}
          decimals={0}
          unit="%"
          icon={Battery}
          sub={batteryBar}
        />
        <StatCard
          label="H₂ TANK · %"
          value={tankPct}
          decimals={0}
          unit="%"
          icon={Flame}
          sub={h2TankBar}
        />
        <StatCard
          label="FLIGHT TIME"
          value={missionElapsed}
          icon={Clock}
        />
      </section>

      {/* ════════════════ ROW 2 — POWER PANELS ══════════════ */}
      <section className={styles.powerRow}>
        <InstrumentCard
          label="BATTERY (LiPo)"
          live={liveStatus}
          bracketFrame
          labelRight={<Zap size={12} strokeWidth={1.6} style={{ color: "var(--chart-battery)" }} />}
        >
          <BatteryPanel />
        </InstrumentCard>

        <InstrumentCard
          label="FUEL CELL (H₂)"
          live={liveStatus}
          bracketFrame
          labelRight={<Zap size={12} strokeWidth={1.6} style={{ color: "var(--chart-fuel-cell)" }} />}
        >
          <FuelCellPanel />
        </InstrumentCard>

        <InstrumentCard
          label="DC BUS (52V)"
          live={liveStatus}
          bracketFrame
          labelRight={<Zap size={12} strokeWidth={1.6} style={{ color: "var(--chart-dc-bus)" }} />}
        >
          <DcBusPanel />
        </InstrumentCard>
      </section>

      {/* ════════════════ ROW 3 — MASTER PCB HARDWARE LINK & CONTROL ════════ */}
      <section className={styles.pcbRow}>
        <MasterPcbControlPanel />
      </section>

      {/* ════════════════ ROW 4 — ATTITUDE + MOTOR POWER ════════ */}
      <section className={styles.flightRow}>
        <InstrumentCard
          label="ATTITUDE"
          live={liveStatus}
          bracketFrame
          className={styles.attitudeCard}
        >
          <AttitudeRing />
        </InstrumentCard>

        <InstrumentCard
          label="MOTOR POWER"
          live={liveStatus}
          bracketFrame
          className={styles.altitudeCard}
        >
          <MotorPowerPanel />
        </InstrumentCard>
      </section>

      {/* ════════════════ ROW 5 — CONTRIBUTION & ALTITUDE ═════ */}
      <section className={styles.gaugeRow}>
        <InstrumentCard label="POWER SOURCE CONTRIBUTION">
          <PowerContribution />
        </InstrumentCard>

        <InstrumentCard label="ALTITUDE · TIME">
          <AltitudeChart />
        </InstrumentCard>
      </section>

      {/* ════════════════ ROW 6 — SYSTEM STATUS ═════════════ */}
      <section className={styles.systemRow}>
        <InstrumentCard label="SYSTEM STATUS">
          <SystemStatusStrip />
        </InstrumentCard>

        <InstrumentCard label="ALERTS">
          <AlertsSummary />
        </InstrumentCard>
      </section>

    </div>
  );
}

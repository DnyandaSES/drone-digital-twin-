/* ────────────────────────────────────────────────────────
   AEROTWIN — COMPONENT STATUS
   Subsystem health panel for the Digital Twin page.
   Covers all ~20 components of the hydrogen hybrid UAV.
   Click a row to highlight the component in the 3D view.
   ──────────────────────────────────────────────────────── */

import {
  Activity,
  Battery,
  Cpu,
  Gauge,
  Radio,
  Wind,
  Zap,
  Cable,
  Flame,
  Sliders,
  Layers,
} from "lucide-react";
import { useTelemetryStore } from "../../store/telemetryStore";
import { useTwinViewStore } from "../../store/twinViewStore";
import styles from "./ComponentStatus.module.css";


type Status = "ok" | "caution" | "critical" | "offline";


interface SubsystemRow {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  status: Status;
  detail: string;
  group: "hydrogen" | "power" | "propulsion" | "comms";
}


function deriveStatus(): SubsystemRow[] {
  const state = useTelemetryStore.getState();
  const { battery, fuelCell, signal, motor, dcBus, gps, masterPcb } = state.current;
  const connected = state.connectionStatus === "connected";
  const valveOpen = masterPcb?.valveOpen ?? false;
  const throttle = masterPcb?.throttle ?? 0;
  const r1 = masterPcb?.r1Resistance ?? 62.0;
  const r2 = masterPcb?.r2Resistance ?? 60.0;

  if (!connected) {
    return [
      { id: "h2cylinder",  label: "H₂ Cylinder",        icon: Gauge,        status: "offline", detail: "—", group: "hydrogen" },
      { id: "fuelcell",    label: "Fuel Cell Stack",      icon: Zap,          status: "offline", detail: "—", group: "hydrogen" },
      { id: "valve",       label: "H₂ Solenoid Valve",    icon: Flame,        status: "offline", detail: "—", group: "hydrogen" },
      { id: "battery",     label: "Battery Pack",         icon: Battery,      status: "offline", detail: "—", group: "power" },
      { id: "pcb",         label: "DC Power Bus",         icon: Cpu,          status: "offline", detail: "—", group: "power" },
      { id: "digipot",     label: "MCP4261 Digipot",      icon: Layers,       status: "offline", detail: "—", group: "power" },
      { id: "esc_master",  label: "ESC Throttle",         icon: Sliders,      status: "offline", detail: "—", group: "propulsion" },
      { id: "motor1",      label: "Motor 1 (LF)",         icon: Activity,     status: "offline", detail: "—", group: "propulsion" },
      { id: "motor2",      label: "Motor 2 (LR)",         icon: Activity,     status: "offline", detail: "—", group: "propulsion" },
      { id: "motor3",      label: "Motor 3 (RF)",         icon: Activity,     status: "offline", detail: "—", group: "propulsion" },
      { id: "motor4",      label: "Motor 4 (RR)",         icon: Activity,     status: "offline", detail: "—", group: "propulsion" },
      { id: "motor5",      label: "Rear Thruster",        icon: Wind,         status: "offline", detail: "—", group: "propulsion" },
      { id: "wiring",      label: "Wiring Harness",       icon: Cable,        status: "offline", detail: "—", group: "power" },
      { id: "comms",       label: "Comms & Link",         icon: Radio,        status: "offline", detail: "—", group: "comms" },
    ];
  }

  // H₂ cylinder & Fuel Cell from received fuelCell parameters
  const h2Pressure = fuelCell.pressure;
  const h2Status: Status = h2Pressure > 150 ? "ok" : h2Pressure > 50 ? "caution" : "critical";
  const fcStatus: Status = fuelCell.temperature < 75 && fuelCell.voltage > 10 ? "ok" :
    fuelCell.temperature < 85 ? "caution" : "critical";

  // Battery
  const batStatus: Status = battery.percentage > 30 ? "ok" : battery.percentage > 15 ? "caution" : "critical";

  // DC Bus
  const dcStatus: Status = dcBus.voltage > 44 ? "ok" : "caution";

  // Motor propulsion
  const motorPower = motor?.power ?? (battery.voltage * battery.current + fuelCell.voltage * fuelCell.current);
  const motorStatus: Status = motorPower > 0 || throttle > 0 ? "ok" : "caution";

  // Comms
  const commsStatus: Status = signal.rssi > -65 ? "ok" : signal.rssi > -80 ? "caution" : "critical";

  return [
    { id: "h2cylinder",  label: "H₂ Tank",             icon: Gauge,       status: h2Status, detail: `${fuelCell.tankPercentage.toFixed(0)}% · ${h2Pressure.toFixed(0)} bar`, group: "hydrogen" },
    { id: "fuelcell",    label: "Fuel Cell Stack",      icon: Zap,         status: fcStatus, detail: `${fuelCell.temperature.toFixed(0)}°C · ${fuelCell.voltage.toFixed(1)}V`, group: "hydrogen" },
    { id: "valve",       label: "H₂ Solenoid Valve",    icon: Flame,       status: valveOpen ? "ok" : "caution", detail: valveOpen ? "OPEN (1)" : "CLOSED (0)", group: "hydrogen" },
    { id: "battery",     label: "Battery Pack",         icon: Battery,     status: batStatus, detail: `${battery.percentage.toFixed(0)}% · ${battery.voltage.toFixed(1)}V`, group: "power" },
    { id: "pcb",         label: "DC Power Bus",         icon: Cpu,         status: dcStatus, detail: `${dcBus.voltage.toFixed(1)}V · ${dcBus.current.toFixed(1)}A`, group: "power" },
    { id: "digipot",     label: "MCP4261 Digipot",      icon: Layers,      status: "ok",     detail: `R1:${r1.toFixed(0)}Ω · R2:${r2.toFixed(0)}Ω`, group: "power" },
    { id: "esc_master",  label: "ESC Throttle",         icon: Sliders,     status: throttle > 0 ? "ok" : "caution", detail: `${throttle}% THR (PWM)`, group: "propulsion" },
    { id: "motor1",      label: "Motor 1 (LF)",         icon: Activity,    status: motorStatus, detail: `${(motorPower * 0.21).toFixed(0)} W`, group: "propulsion" },
    { id: "motor2",      label: "Motor 2 (LR)",         icon: Activity,    status: motorStatus, detail: `${(motorPower * 0.21).toFixed(0)} W`, group: "propulsion" },
    { id: "motor3",      label: "Motor 3 (RF)",         icon: Activity,    status: motorStatus, detail: `${(motorPower * 0.21).toFixed(0)} W`, group: "propulsion" },
    { id: "motor4",      label: "Motor 4 (RR)",         icon: Activity,    status: motorStatus, detail: `${(motorPower * 0.21).toFixed(0)} W`, group: "propulsion" },
    { id: "motor5",      label: "Rear Thruster",        icon: Wind,        status: motorStatus, detail: `${(motorPower * 0.16).toFixed(0)} W`, group: "propulsion" },
    { id: "wiring",      label: "Wiring Harness",       icon: Cable,       status: "ok",     detail: "OK", group: "power" },
    { id: "comms",       label: "Radio & GPS",          icon: Radio,       status: commsStatus, detail: `${signal.rssi} dBm · ${gps.satellites} Sats`, group: "comms" },
  ];
}


const STATUS_LABEL: Record<Status, string> = {
  ok:       "OK",
  caution:  "CAUTION",
  critical: "CRITICAL",
  offline:  "OFFLINE",
};

const GROUP_LABELS: Record<string, string> = {
  hydrogen: "HYDROGEN SYSTEM",
  power: "POWER",
  propulsion: "PROPULSION",
  comms: "COMMUNICATIONS",
};


export default function ComponentStatus() {
  const connected = useTelemetryStore((s) => s.connectionStatus);
  void connected;
  const _current = useTelemetryStore((s) => s.current);
  void _current;

  const highlightedComponent = useTwinViewStore((s) => s.highlightedComponent);
  const setHighlightedComponent = useTwinViewStore((s) => s.setHighlightedComponent);

  const rows = deriveStatus();

  // Group rows by section
  const groups = ["hydrogen", "power", "propulsion", "comms"];

  return (
    <div className={styles.panel}>
      <div className={styles.header}>COMPONENT STATUS</div>

      <div className={styles.list}>
        {groups.map((g) => {
          const groupRows = rows.filter((r) => r.group === g);
          if (groupRows.length === 0) return null;
          return (
            <div key={g}>
              <div className={styles.groupLabel}>{GROUP_LABELS[g]}</div>
              {groupRows.map((row) => {
                const Icon = row.icon;
                const isActive = highlightedComponent === row.id;
                return (
                  <div
                    key={row.id}
                    className={`${styles.row} ${styles[row.status]} ${isActive ? styles.highlighted : ""}`}
                    onClick={() => setHighlightedComponent(isActive ? null : row.id)}
                    title={`Click to ${isActive ? "unhighlight" : "highlight"} in 3D view`}
                  >
                    <span className={styles.icon}><Icon size={12} strokeWidth={1.6} /></span>
                    <span className={styles.name}>{row.label}</span>
                    <span className={styles.detail}>{row.detail}</span>
                    <span className={`${styles.badge} ${styles[row.status]}`}>
                      {STATUS_LABEL[row.status]}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

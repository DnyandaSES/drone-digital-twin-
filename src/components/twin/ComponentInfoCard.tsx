/* ────────────────────────────────────────────────────────
   AEROTWIN — COMPONENT INFO CARD
   Floating inspection HUD card displayed when a component
   is clicked in the 3D viewport or sidebar.
   ──────────────────────────────────────────────────────── */

import { useMemo } from "react";
import {
  X,
  Activity,
  Battery,
  Cpu,
  Gauge,
  Wind,
  Zap,
  Flame,
  Cable,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Layers,
  Maximize2,
} from "lucide-react";
import { useTwinViewStore } from "../../store/twinViewStore";
import { useTelemetryStore } from "../../store/telemetryStore";
import styles from "./ComponentInfoCard.module.css";

interface ComponentSpec {
  id: string;
  name: string;
  subsystem: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  description: string;
  specs: { label: string; value: string }[];
  upstream?: string;
  downstream?: string;
}

const COMPONENT_REGISTRY: Record<string, ComponentSpec> = {
  h2cylinder: {
    id: "h2cylinder",
    name: "H₂ Storage Cylinder",
    subsystem: "Hydrogen Fuel System",
    icon: Gauge,
    description: "Type-IV carbon-fiber wrapped high-pressure composite tank mounted horizontally in the rear-central chassis for primary fuel storage.",
    specs: [
      { label: "Tank Length", value: "526 mm" },
      { label: "Nominal Pressure", value: "350 bar (5,076 psi)" },
      { label: "Water Capacity", value: "9.0 Liters" },
      { label: "Empty Weight", value: "4.2 kg" },
      { label: "Liner Material", value: "High-density Polyethylene (HDPE)" },
      { label: "Overwrap", value: "Toray Carbon Fiber / Epoxy Resin" },
    ],
    upstream: "Refueling Port / Safety Burst Disc",
    downstream: "Pressure Sensor 1 & Shutoff Assembly",
  },
  sensor1: {
    id: "sensor1",
    name: "Pressure Sensor 1 (P1)",
    subsystem: "Hydrogen Fuel System",
    icon: Gauge,
    description: "High-pressure industrial piezoresistive transducer installed immediately downstream of the cylinder outlet valve to monitor tank delivery pressure.",
    specs: [
      { label: "Measurement Range", value: "0 – 400 bar" },
      { label: "Accuracy", value: "±0.25% Full Scale" },
      { label: "Interface", value: "G1/4 Stainless Steel Male" },
      { label: "Signal Protocol", value: "0.5 – 4.5V Ratiometric / CAN" },
      { label: "Response Time", value: "< 2 ms" },
      { label: "Operating Temp", value: "-40°C to +85°C" },
    ],
    upstream: "H₂ Cylinder Outlet",
    downstream: "Dual-Stage Gas Regulator",
  },
  regulator: {
    id: "regulator",
    name: "H₂ Pressure Regulator",
    subsystem: "Hydrogen Fuel System",
    icon: Gauge,
    description: "High-precision dual-stage gas regulation assembly with emergency solenoid shutoff valves and anodized control caps.",
    specs: [
      { label: "Inlet Pressure Max", value: "350 bar" },
      { label: "Regulated Delivery", value: "1.5 – 3.0 bar (Nominal 2.5 bar)" },
      { label: "Flow Capacity", value: "120 L/min H₂ @ STP" },
      { label: "Body Material", value: "Nickel-Plated Brass / 316L SS" },
      { label: "Actuation", value: "12V Direct Solenoid" },
      { label: "Fail-Safe Mode", value: "Normally Closed (NC)" },
    ],
    upstream: "Pressure Sensor 1 (P1)",
    downstream: "H₂ Fuel Delivery Line",
  },
  h2piping: {
    id: "h2piping",
    name: "H₂ Fuel Delivery Line",
    subsystem: "Hydrogen Fuel System",
    icon: Flame,
    description: "Rigid high-grade seamless stainless steel and flexible PTFE gas piping routing regulated hydrogen into the fuel cell stack.",
    specs: [
      { label: "Outer Diameter", value: "6.35 mm (1/4 in)" },
      { label: "Working Pressure", value: "50 bar max rating" },
      { label: "Material", value: "Seamless 316L SS / PTFE core" },
      { label: "Fittings", value: "Twin-ferrule Swagelok compression" },
      { label: "Flow Indicators", value: "Active directional check valves" },
    ],
    upstream: "H₂ Pressure Regulator",
    downstream: "Pressure Sensor 2 & Fuel Cell Inlet",
  },
  fuelcell: {
    id: "fuelcell",
    name: "PEM Fuel Cell Stack",
    subsystem: "Primary Power Generation",
    icon: Zap,
    description: "Air-cooled Proton Exchange Membrane (PEM) fuel cell module with aluminum cooling fins and integrated cathode air blower.",
    specs: [
      { label: "Stack Technology", value: "Proton Exchange Membrane (PEM)" },
      { label: "Rated Output Power", value: "1,500 Watts continuous" },
      { label: "Operating Voltage", value: "24 – 38 V DC" },
      { label: "Stack Weight", value: "3.6 kg" },
      { label: "Cooling Method", value: "Forced Convection Axial Air" },
      { label: "Operating Temp Range", value: "+5°C to +75°C (Opt: 55°C)" },
    ],
    upstream: "H₂ Fuel Delivery Line",
    downstream: "Power Management PCB (DC Bus)",
  },
  sensor2: {
    id: "sensor2",
    name: "Pressure Sensor 2 (P2)",
    subsystem: "Hydrogen Fuel System",
    icon: Gauge,
    description: "Low-pressure monitoring transducer located directly at the fuel cell hydrogen inlet manifold to ensure stable stack delivery.",
    specs: [
      { label: "Measurement Range", value: "0 – 10 bar" },
      { label: "Accuracy", value: "±0.1% Full Scale" },
      { label: "Port Fitting", value: "M10x1.0 Stainless Steel" },
      { label: "Function", value: "Differential ΔP calculation with P1" },
      { label: "Telemetry Stream", value: "20 Hz High-Speed SPI" },
    ],
    upstream: "H₂ Delivery Line",
    downstream: "Fuel Cell Stack Inlet Manifold",
  },
  battery: {
    id: "battery",
    name: "Hybrid LiPo Buffer Battery",
    subsystem: "Energy Storage & Boost",
    icon: Battery,
    description: "High-discharge Lithium-Polymer hybrid buffer battery providing surge power during takeoff/VTOL climbs and peak dynamic loads.",
    specs: [
      { label: "Cell Configuration", value: "12S1P (44.4 V Nominal)" },
      { label: "Rated Capacity", value: "8,500 mAh (377.4 Wh)" },
      { label: "Continuous Discharge", value: "45C (380 A continuous)" },
      { label: "Peak Burst Discharge", value: "90C (760 A peak 10s)" },
      { label: "Cell Chemistry", value: "Lithium Polymer High-Rate" },
      { label: "Pack Weight", value: "2.15 kg" },
    ],
    upstream: "Charging Bus / Fuel Cell DC-DC",
    downstream: "Power Management PCB & ESC Rails",
  },
  pcb: {
    id: "pcb",
    name: "Power Management PCB",
    subsystem: "Central Avionics & Control",
    icon: Cpu,
    description: "Multi-layer power distribution and avionics control PCB housed in a transparent protective acrylic enclosure with isolated telemetry buses.",
    specs: [
      { label: "Microcontroller", value: "STM32H743 Dual-Core ARM Cortex-M7" },
      { label: "DC-DC Topology", value: "Synchronous Multi-phase Buck-Boost" },
      { label: "Telemetry Interfaces", value: "CAN 2.0B, UART, SPI, I2C" },
      { label: "Current Sensing", value: "Hall-Effect 200A Isolated Rails" },
      { label: "Power Bus Voltage", value: "48.0 V Regulated Main Bus" },
      { label: "Enclosure", value: "High-Clarity Optical Grade Acrylic" },
    ],
    upstream: "Battery Pack & Fuel Cell Stack",
    downstream: "ESCs 1–5, Avionics, Sensor Harness",
  },
  motor1: {
    id: "motor1",
    name: "Motor 1 (Left-Forward Lift)",
    subsystem: "Propulsion System",
    icon: Activity,
    description: "High-torque brushless DC motor in the port-forward ducted wing position with a 15-inch multi-blade carbon propeller and safety cage.",
    specs: [
      { label: "Motor Type", value: "Brushless Outrunner 5208" },
      { label: "KV Rating", value: "340 KV" },
      { label: "Propeller Size", value: "15 x 5.5 inch Carbon Fiber" },
      { label: "Max Thrust", value: "4.8 kgf @ 100% Throttle" },
      { label: "Operating Voltage", value: "44.4 V – 50.4 V (12S)" },
      { label: "Safety Guard", value: "15-inch Cylindrical Mesh Cage" },
    ],
    upstream: "ESC 1 & Main Power Rail",
    downstream: "Vertical Lift Generation (Port Forward)",
  },
  motor2: {
    id: "motor2",
    name: "Motor 2 (Left-Aft Lift)",
    subsystem: "Propulsion System",
    icon: Activity,
    description: "High-torque brushless DC motor in the port-aft ducted wing position with counter-rotating propeller and protective guard.",
    specs: [
      { label: "Motor Type", value: "Brushless Outrunner 5208" },
      { label: "KV Rating", value: "340 KV" },
      { label: "Propeller Size", value: "15 x 5.5 inch Carbon Fiber (CCW)" },
      { label: "Max Thrust", value: "4.8 kgf @ 100% Throttle" },
      { label: "Operating Voltage", value: "44.4 V – 50.4 V (12S)" },
      { label: "Safety Guard", value: "15-inch Cylindrical Mesh Cage" },
    ],
    upstream: "ESC 2 & Main Power Rail",
    downstream: "Vertical Lift Generation (Port Aft)",
  },
  motor3: {
    id: "motor3",
    name: "Motor 3 (Right-Forward Lift)",
    subsystem: "Propulsion System",
    icon: Activity,
    description: "High-torque brushless DC motor in the starboard-forward ducted wing position with counter-rotating propeller and cage.",
    specs: [
      { label: "Motor Type", value: "Brushless Outrunner 5208" },
      { label: "KV Rating", value: "340 KV" },
      { label: "Propeller Size", value: "15 x 5.5 inch Carbon Fiber (CCW)" },
      { label: "Max Thrust", value: "4.8 kgf @ 100% Throttle" },
      { label: "Operating Voltage", value: "44.4 V – 50.4 V (12S)" },
      { label: "Safety Guard", value: "15-inch Cylindrical Mesh Cage" },
    ],
    upstream: "ESC 3 & Main Power Rail",
    downstream: "Vertical Lift Generation (Stbd Forward)",
  },
  motor4: {
    id: "motor4",
    name: "Motor 4 (Right-Aft Lift)",
    subsystem: "Propulsion System",
    icon: Activity,
    description: "High-torque brushless DC motor in the starboard-aft ducted wing position with clockwise propeller and cage.",
    specs: [
      { label: "Motor Type", value: "Brushless Outrunner 5208" },
      { label: "KV Rating", value: "340 KV" },
      { label: "Propeller Size", value: "15 x 5.5 inch Carbon Fiber (CW)" },
      { label: "Max Thrust", value: "4.8 kgf @ 100% Throttle" },
      { label: "Operating Voltage", value: "44.4 V – 50.4 V (12S)" },
      { label: "Safety Guard", value: "15-inch Cylindrical Mesh Cage" },
    ],
    upstream: "ESC 4 & Main Power Rail",
    downstream: "Vertical Lift Generation (Stbd Aft)",
  },
  motor5: {
    id: "motor5",
    name: "Rear Longitudinal Thruster",
    subsystem: "Propulsion System",
    icon: Wind,
    description: "Tail-mounted horizontal thrust motor with an exposed 3-blade propeller for high-efficiency forward cruising and speed control.",
    specs: [
      { label: "Motor Type", value: "Aerospace Brushless Inrunner 4074" },
      { label: "KV Rating", value: "620 KV" },
      { label: "Propeller Size", value: "11 x 7.0 inch 3-Blade Exposed" },
      { label: "Max Forward Thrust", value: "5.5 kgf" },
      { label: "Mounting Position", value: "Longitudinal Centerline Tail Boom" },
      { label: "Function", value: "Horizontal Forward/Reverse Flight" },
    ],
    upstream: "ESC 5 & Main Power Rail",
    downstream: "Longitudinal Vector Thrust",
  },
  esc1: {
    id: "esc1",
    name: "ESC 1 (Motor 1 Drive)",
    subsystem: "Propulsion Electronics",
    icon: Cpu,
    description: "Field-Oriented Control (FOC) smart electronic speed controller with real-time RPM, temperature, and current telemetry feedback.",
    specs: [
      { label: "Current Rating", value: "60A Continuous (80A Peak)" },
      { label: "Voltage Range", value: "6S – 14S LiPo" },
      { label: "Control Protocol", value: "DShot1200 / FOC Sine Wave" },
      { label: "Cooling", value: "Aluminum Heat Spreader Plate" },
    ],
    upstream: "Power PCB",
    downstream: "Motor 1",
  },
  esc2: {
    id: "esc2",
    name: "ESC 2 (Motor 2 Drive)",
    subsystem: "Propulsion Electronics",
    icon: Cpu,
    description: "FOC smart electronic speed controller with real-time telemetry feedback for Motor 2.",
    specs: [
      { label: "Current Rating", value: "60A Continuous (80A Peak)" },
      { label: "Voltage Range", value: "6S – 14S LiPo" },
      { label: "Control Protocol", value: "DShot1200 / FOC Sine Wave" },
      { label: "Cooling", value: "Aluminum Heat Spreader Plate" },
    ],
    upstream: "Power PCB",
    downstream: "Motor 2",
  },
  esc3: {
    id: "esc3",
    name: "ESC 3 (Motor 3 Drive)",
    subsystem: "Propulsion Electronics",
    icon: Cpu,
    description: "FOC smart electronic speed controller with real-time telemetry feedback for Motor 3.",
    specs: [
      { label: "Current Rating", value: "60A Continuous (80A Peak)" },
      { label: "Voltage Range", value: "6S – 14S LiPo" },
      { label: "Control Protocol", value: "DShot1200 / FOC Sine Wave" },
      { label: "Cooling", value: "Aluminum Heat Spreader Plate" },
    ],
    upstream: "Power PCB",
    downstream: "Motor 3",
  },
  esc4: {
    id: "esc4",
    name: "ESC 4 (Motor 4 Drive)",
    subsystem: "Propulsion Electronics",
    icon: Cpu,
    description: "FOC smart electronic speed controller with real-time telemetry feedback for Motor 4.",
    specs: [
      { label: "Current Rating", value: "60A Continuous (80A Peak)" },
      { label: "Voltage Range", value: "6S – 14S LiPo" },
      { label: "Control Protocol", value: "DShot1200 / FOC Sine Wave" },
      { label: "Cooling", value: "Aluminum Heat Spreader Plate" },
    ],
    upstream: "Power PCB",
    downstream: "Motor 4",
  },
  esc5: {
    id: "esc5",
    name: "ESC 5 (Rear Thruster Drive)",
    subsystem: "Propulsion Electronics",
    icon: Cpu,
    description: "High-current FOC electronic speed controller tuned for the rear cruise thruster motor.",
    specs: [
      { label: "Current Rating", value: "75A Continuous (100A Peak)" },
      { label: "Voltage Range", value: "6S – 14S LiPo" },
      { label: "Control Protocol", value: "DShot1200 / FOC Sine Wave" },
      { label: "Cooling", value: "Aluminum Heat Spreader Plate" },
    ],
    upstream: "Power PCB",
    downstream: "Rear Thrust Motor 5",
  },
  wiring: {
    id: "wiring",
    name: "Power & Signal Wiring Harness",
    subsystem: "Electrical Distribution",
    icon: Cable,
    description: "Silicone-jacketed heavy-gauge multi-conductor power lines and shielded twisted-pair signal cables with aerospace grade connectors.",
    specs: [
      { label: "Power Cables", value: "8 AWG Multi-strand Silicone (Orange/Blue)" },
      { label: "Signal Wiring", value: "26 AWG Shielded Twisted Pair" },
      { label: "Insulation Rating", value: "200°C / 600V Fire-Resistant" },
      { label: "Routing Clamps", value: "Chassis-integrated nylon retaining clips" },
    ],
    upstream: "Battery, Fuel Cell & PCB",
    downstream: "ESCs, Sensors & Telemetry Antennas",
  },
  frame: {
    id: "frame",
    name: "Internal Structural Frame",
    subsystem: "Mechanical Architecture",
    icon: Layers,
    description: "Rigid CNC-machined 6061-T6 aluminum extrusion chassis with carbon-fiber cross members and vibration-isolated mounting trays.",
    specs: [
      { label: "Total Length", value: "1,800 mm" },
      { label: "Chassis Width", value: "320 mm (Fuselage Base)" },
      { label: "Main Beams", value: "Extruded 6061-T6 Aluminum Box Section" },
      { label: "Mounting Trays", value: "3K Twill Carbon Fiber 2.5 mm Plates" },
      { label: "Dampening", value: "Silicone Anti-vibration Grommets" },
      { label: "Standoff Legs", value: "4x High-Strength Landing Stanchions" },
    ],
    upstream: "Mounts all internal subsystems",
    downstream: "Outer Aerodynamic Shell",
  },
  shell: {
    id: "shell",
    name: "Aero Flying-Wing Shell",
    subsystem: "Aerodynamic Structure",
    icon: Layers,
    description: "Sleek translucent blended flying-wing outer body featuring 4 integrated ducted prop cutouts and twin rear vertical stabilizers.",
    specs: [
      { label: "Material", value: "Optical Composite / Smoked Polycarbonate" },
      { label: "Wingspan", value: "2,200 mm" },
      { label: "Length", value: "1,800 mm" },
      { label: "Fuselage Profile", value: "Blended Wing Body (BWB)" },
      { label: "Aerodynamic Openings", value: "4x 15-inch Integrated Ducts" },
      { label: "Empennage", value: "Twin Rear Vertical Stabilizer Fins" },
    ],
    upstream: "Internal Structural Frame",
    downstream: "Aerodynamic Flight Performance",
  },
};

export default function ComponentInfoCard() {
  const highlightedComponent = useTwinViewStore((s) => s.highlightedComponent);
  const setHighlightedComponent = useTwinViewStore((s) => s.setHighlightedComponent);
  const faultOverrides = useTwinViewStore((s) => s.faultOverrides);

  // Live telemetry data
  const battery = useTelemetryStore((s) => s.current.battery);
  const fuelCell = useTelemetryStore((s) => s.current.fuelCell);
  const dcBus = useTelemetryStore((s) => s.current.dcBus);
  const motor = useTelemetryStore((s) => s.current.motor);
  const signal = useTelemetryStore((s) => s.current.signal);
  const gps = useTelemetryStore((s) => s.current.gps);
  const flight = useTelemetryStore((s) => s.current.flight);

  const spec = useMemo(() => {
    if (!highlightedComponent) return null;
    return COMPONENT_REGISTRY[highlightedComponent] || null;
  }, [highlightedComponent]);

  if (!spec) return null;

  const Icon = spec.icon;
  const faultLevel = faultOverrides[spec.id] || "normal";

  // Derive live dynamic metrics for this specific component strictly from received parameters
  const liveMetrics: { label: string; value: string; status?: "ok" | "caution" | "critical" }[] = [];

  const totalMotorPower = motor?.power ?? (battery.voltage * battery.current + fuelCell.voltage * fuelCell.current);

  if (spec.id === "h2cylinder") {
    liveMetrics.push(
      { label: "Tank Fuel Level", value: `${Math.round(fuelCell.tankPercentage)} %`, status: fuelCell.tankPercentage > 25 ? "ok" : "caution" },
      { label: "Cylinder Pressure", value: `${fuelCell.pressure.toFixed(1)} bar`, status: fuelCell.pressure > 150 ? "ok" : "caution" },
      { label: "Fuel Cell Current", value: `${fuelCell.current.toFixed(1)} A`, status: "ok" },
      { label: "Fuel Cell Voltage", value: `${fuelCell.voltage.toFixed(1)} V`, status: "ok" }
    );
  } else if (spec.id === "fuelcell") {
    liveMetrics.push(
      { label: "Stack Voltage", value: `${fuelCell.voltage.toFixed(1)} V`, status: fuelCell.voltage > 12 ? "ok" : "caution" },
      { label: "Stack Current", value: `${fuelCell.current.toFixed(1)} A`, status: "ok" },
      { label: "Stack Power", value: `${(fuelCell.voltage * fuelCell.current).toFixed(0)} W`, status: "ok" },
      { label: "Stack Temperature", value: `${fuelCell.temperature.toFixed(1)} °C`, status: fuelCell.temperature < 75 ? "ok" : "critical" },
      { label: "Supply Pressure", value: `${fuelCell.pressure.toFixed(1)} bar`, status: "ok" },
      { label: "Tank Level", value: `${fuelCell.tankPercentage.toFixed(1)} %`, status: "ok" }
    );
  } else if (spec.id === "battery") {
    liveMetrics.push(
      { label: "State of Charge (SoC)", value: `${battery.percentage.toFixed(1)} %`, status: battery.percentage > 30 ? "ok" : battery.percentage > 15 ? "caution" : "critical" },
      { label: "Pack Voltage", value: `${battery.voltage.toFixed(1)} V`, status: battery.voltage > 11 ? "ok" : "caution" },
      { label: "Discharge Current", value: `${battery.current.toFixed(1)} A`, status: "ok" },
      { label: "Pack Temperature", value: `${battery.temperature.toFixed(1)} °C`, status: battery.temperature < 55 ? "ok" : "caution" },
      { label: "Power Output", value: `${(battery.voltage * battery.current).toFixed(0)} W`, status: "ok" }
    );
  } else if (spec.id === "pcb") {
    liveMetrics.push(
      { label: "DC Bus Voltage", value: `${dcBus.voltage.toFixed(1)} V`, status: "ok" },
      { label: "DC Bus Current", value: `${dcBus.current.toFixed(1)} A`, status: "ok" },
      { label: "Total Bus Power", value: `${(dcBus.voltage * dcBus.current).toFixed(0)} W`, status: "ok" },
      { label: "Link RSSI", value: `${signal.rssi} dBm`, status: "ok" }
    );
  } else if (spec.id.startsWith("motor")) {
    const estPower = spec.id === "motor5" ? totalMotorPower * 0.16 : totalMotorPower * 0.21;
    liveMetrics.push(
      { label: "Allocated Power", value: `${estPower.toFixed(0)} W`, status: "ok" },
      { label: "Total Motor Power", value: `${totalMotorPower.toFixed(0)} W`, status: "ok" },
      { label: "Airspeed", value: `${flight.speed.toFixed(1)} m/s`, status: "ok" },
      { label: "Altitude", value: `${flight.altitude.toFixed(1)} m`, status: "ok" }
    );
  } else if (spec.id === "comms" || spec.id === "wiring") {
    liveMetrics.push(
      { label: "Radio RSSI", value: `${signal.rssi} dBm`, status: signal.rssi > -75 ? "ok" : "caution" },
      { label: "GPS Satellites", value: `${gps.satellites}`, status: gps.satellites >= 6 ? "ok" : "caution" },
      { label: "Latitude", value: `${gps.latitude.toFixed(6)}°`, status: "ok" },
      { label: "Longitude", value: `${gps.longitude.toFixed(6)}°`, status: "ok" }
    );
  } else {
    liveMetrics.push(
      { label: "Altitude", value: `${flight.altitude.toFixed(1)} m`, status: "ok" },
      { label: "Airspeed", value: `${flight.speed.toFixed(1)} m/s`, status: "ok" },
      { label: "Heading (Yaw)", value: `${flight.yaw.toFixed(1)}°`, status: "ok" },
      { label: "Roll / Pitch", value: `${flight.roll.toFixed(1)}° / ${flight.pitch.toFixed(1)}°`, status: "ok" }
    );
  }

  return (
    <div className={styles.card}>
      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <div className={styles.iconBox}>
            <Icon size={16} strokeWidth={1.8} />
          </div>
          <div>
            <div className={styles.subsystem}>{spec.subsystem}</div>
            <h3 className={styles.name}>{spec.name}</h3>
          </div>
        </div>

        <button
          className={styles.closeBtn}
          onClick={() => setHighlightedComponent(null)}
          title="Close component inspection"
        >
          <X size={14} strokeWidth={2} />
        </button>
      </div>

      {/* Description */}
      <p className={styles.description}>{spec.description}</p>

      {/* Live Telemetry Grid */}
      <div className={styles.sectionTitle}>
        <Activity size={11} strokeWidth={1.8} />
        <span>LIVE TELEMETRY READOUT</span>
      </div>

      <div className={styles.metricsGrid}>
        {liveMetrics.map((m, i) => (
          <div key={i} className={styles.metricItem}>
            <span className={styles.metricLabel}>{m.label}</span>
            <div className={styles.metricValRow}>
              <span className={styles.metricValue}>{m.value}</span>
              {m.status === "ok" && <CheckCircle2 size={11} color="var(--status-ok, #22C55E)" />}
              {m.status === "caution" && <AlertTriangle size={11} color="var(--status-caution, #F59E0B)" />}
              {m.status === "critical" && <XCircle size={11} color="var(--status-critical, #EF4444)" />}
            </div>
          </div>
        ))}
      </div>

      {/* Engineering Specs */}
      <div className={styles.sectionTitle}>
        <Maximize2 size={11} strokeWidth={1.8} />
        <span>ENGINEERING SPECIFICATIONS</span>
      </div>

      <div className={styles.specsList}>
        {spec.specs.map((s, i) => (
          <div key={i} className={styles.specRow}>
            <span className={styles.specLabel}>{s.label}</span>
            <span className={styles.specValue}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* Connections flow */}
      {(spec.upstream || spec.downstream) && (
        <div className={styles.connectionBox}>
          {spec.upstream && (
            <div className={styles.connItem}>
              <span className={styles.connLabel}>INFLOW / SOURCE:</span>
              <span className={styles.connValue}>{spec.upstream}</span>
            </div>
          )}
          {spec.downstream && (
            <div className={styles.connItem}>
              <span className={styles.connLabel}>OUTFLOW / TARGET:</span>
              <span className={styles.connValue}>{spec.downstream}</span>
            </div>
          )}
        </div>
      )}

      {/* Fault Override Badge if active */}
      {faultLevel !== "normal" && (
        <div className={`${styles.faultAlert} ${styles[faultLevel]}`}>
          <AlertTriangle size={13} strokeWidth={2} />
          <span>SIMULATED STATE: {faultLevel.toUpperCase()}</span>
        </div>
      )}
    </div>
  );
}

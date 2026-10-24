/* ────────────────────────────────────────────────────────
   AEROTWIN — TELEMETRY PARSER & NORMALIZER
   Converts incoming UDP packets from the ESP32 Master PCB
   into standardized Telemetry snapshots for state and 3D twin.
   ──────────────────────────────────────────────────────── */

import type { Telemetry } from "../types/telemetry";

export interface MasterPcbRawPayload {
  vB?: number;       // Battery Voltage (V)
  iB?: number;       // Battery Current (A)
  pB?: number;       // Battery Power (W)
  vF?: number;       // Fuel Cell Voltage (V)
  iF?: number;       // Fuel Cell Current (A)
  pF?: number;       // Fuel Cell Power (W)
  vC?: number;       // Common DC Bus Voltage (V)
  iC?: number;       // Common DC Bus Current (A)
  pC?: number;       // Common DC Bus Power (W)
  thr?: number;      // Throttle % (0-100)
  rssi?: number;     // WiFi RSSI (dBm)
  battPct?: number;  // Battery State of Charge %
  tankPct?: number;  // Fuel Cell Tank %
  pres?: number;     // Fuel Cell Pressure
  tempB?: number;    // Battery Temperature (°C)
  tempF?: number;    // Fuel Cell Temperature (°C)
  vlv?: number | boolean; // Solenoid Valve State (1=Open, 0=Closed)
  r1?: number;       // MCP4261 IC1 Resistance (Ohm)
  r2?: number;       // MCP4261 IC2 Resistance (Ohm)
  timestamp?: number;
  flight?: {
    altitude?: number;
    speed?: number;
    roll?: number;
    pitch?: number;
    yaw?: number;
  };
  gps?: {
    latitude?: number;
    longitude?: number;
    satellites?: number;
  };
}

/**
 * Normalizes any incoming telemetry JSON payload (ESP32 Master PCB or legacy structure)
 * into a fully populated Telemetry snapshot.
 */
export function normalizeTelemetry(raw: unknown): Telemetry {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid telemetry payload: Expected non-null object");
  }

  const p = raw as MasterPcbRawPayload & Record<string, any>;

  // Check if incoming payload is the Master PCB format (compact keys: vB, vC, vF, thr)
  const isMasterPcb = "vB" in p || "vC" in p || "vF" in p || "thr" in p || "vlv" in p;

  if (isMasterPcb) {
    const vBatt = Number(p.vB ?? 0);
    const iBatt = Number(p.iB ?? 0);
    const pBatt = Number(p.pB ?? (vBatt * iBatt));

    const vFC = Number(p.vF ?? 0);
    const iFC = Number(p.iF ?? 0);
    const pFC = Number(p.pF ?? (vFC * iFC));

    const vBus = Number(p.vC ?? 0);
    const iBus = Number(p.iC ?? 0);
    const pBus = Number(p.pC ?? (vBus * iBus));

    const throttle = Math.max(0, Math.min(100, Number(p.thr ?? 0)));
    const rssi = Number(p.rssi ?? -55);

    // Battery %
    let battPct = Number(p.battPct ?? 0);
    if (!p.battPct && vBatt > 10.0) {
      if (vBatt > 18.0) {
        battPct = Math.min(100, Math.max(0, ((vBatt - 20.0) / (29.4 - 20.0)) * 100));
      } else {
        battPct = Math.min(100, Math.max(0, ((vBatt - 10.5) / (16.8 - 10.5)) * 100));
      }
    }

    const tankPct = Number(p.tankPct ?? 92);
    const pressure = Number(p.pres ?? (tankPct / 100) * 300);
    const tempB = Number(p.tempB ?? (30.0 + Math.abs(iBatt) * 0.25));
    const tempF = Number(p.tempF ?? (35.0 + Math.abs(iFC) * 0.35));
    const valveOpen = p.vlv === 1 || p.vlv === true || String(p.vlv) === "1";
    const r1 = Number(p.r1 ?? 62.0);
    const r2 = Number(p.r2 ?? 60.0);

    const motorPower = pBus > 0 ? pBus : (pBatt + pFC);

    // Dynamic flight simulation driven by ESC throttle when dedicated IMU is absent
    const nowSec = Date.now() / 1000;
    const estAltitude = throttle > 0 ? (throttle / 100) * 120 + Math.sin(nowSec * 0.5) * 2 : 0;
    const estSpeed = throttle > 0 ? (throttle / 100) * 14 + Math.sin(nowSec * 0.8) * 0.5 : 0;
    const estPitch = throttle > 0 ? -1.5 + Math.sin(nowSec * 1.2) * 1.0 : 0;
    const estRoll = throttle > 0 ? Math.cos(nowSec * 0.9) * 1.2 : 0;
    const estYaw = throttle > 0 ? (Math.sin(nowSec * 0.2) * 15) : 0;

    return {
      timestamp: Date.now(),
      flight: {
        altitude: parseFloat((p.flight?.altitude ?? estAltitude).toFixed(1)),
        speed: parseFloat((p.flight?.speed ?? estSpeed).toFixed(1)),
        roll: parseFloat((p.flight?.roll ?? estRoll).toFixed(1)),
        pitch: parseFloat((p.flight?.pitch ?? estPitch).toFixed(1)),
        yaw: parseFloat((p.flight?.yaw ?? estYaw).toFixed(1)),
      },
      gps: {
        latitude: p.gps?.latitude ?? 18.5203,
        longitude: p.gps?.longitude ?? 73.8567,
        satellites: p.gps?.satellites ?? 12,
      },
      battery: {
        voltage: parseFloat(vBatt.toFixed(2)),
        current: parseFloat(iBatt.toFixed(2)),
        percentage: parseFloat(battPct.toFixed(1)),
        temperature: parseFloat(tempB.toFixed(1)),
      },
      fuelCell: {
        voltage: parseFloat(vFC.toFixed(2)),
        current: parseFloat(iFC.toFixed(2)),
        temperature: parseFloat(tempF.toFixed(1)),
        tankPercentage: parseFloat(tankPct.toFixed(1)),
        pressure: parseFloat(pressure.toFixed(1)),
      },
      dcBus: {
        voltage: parseFloat(vBus.toFixed(2)),
        current: parseFloat(iBus.toFixed(2)),
      },
      signal: {
        rssi,
      },
      motor: {
        power: parseFloat(motorPower.toFixed(1)),
      },
      masterPcb: {
        throttle,
        valveOpen,
        r1Resistance: parseFloat(r1.toFixed(1)),
        r2Resistance: parseFloat(r2.toFixed(1)),
        batteryPower: parseFloat(pBatt.toFixed(1)),
        fuelCellPower: parseFloat(pFC.toFixed(1)),
        commonBusPower: parseFloat(pBus.toFixed(1)),
      },
    };
  }

  // Legacy structured payload format
  const rawMotor = p.motor as unknown;
  const motorPower =
    typeof rawMotor === "number"
      ? rawMotor
      : p.motor?.power ?? ((p.battery?.voltage ?? 0) * (p.battery?.current ?? 0) + (p.fuelCell?.voltage ?? 0) * (p.fuelCell?.current ?? 0));

  return {
    timestamp: p.timestamp ?? Date.now(),
    flight: {
      altitude: p.flight?.altitude ?? 0,
      speed: p.flight?.speed ?? 0,
      roll: p.flight?.roll ?? 0,
      pitch: p.flight?.pitch ?? 0,
      yaw: p.flight?.yaw ?? 0,
    },
    gps: {
      latitude: p.gps?.latitude ?? 0,
      longitude: p.gps?.longitude ?? 0,
      satellites: p.gps?.satellites ?? 0,
    },
    battery: {
      voltage: p.battery?.voltage ?? 0,
      current: p.battery?.current ?? 0,
      percentage: p.battery?.percentage ?? 0,
      temperature: p.battery?.temperature ?? 0,
    },
    fuelCell: {
      voltage: p.fuelCell?.voltage ?? 0,
      current: p.fuelCell?.current ?? 0,
      temperature: p.fuelCell?.temperature ?? 0,
      tankPercentage: p.fuelCell?.tankPercentage ?? 0,
      pressure: p.fuelCell?.pressure ?? 0,
    },
    dcBus: {
      voltage: p.dcBus?.voltage ?? 0,
      current: p.dcBus?.current ?? 0,
    },
    signal: {
      rssi: p.signal?.rssi ?? 0,
    },
    motor: {
      power: motorPower,
    },
    masterPcb: p.masterPcb ?? {
      throttle: p.masterPcb?.throttle ?? (motorPower > 0 ? 40 : 0),
      valveOpen: p.masterPcb?.valveOpen ?? true,
      r1Resistance: p.masterPcb?.r1Resistance ?? 62.0,
      r2Resistance: p.masterPcb?.r2Resistance ?? 60.0,
      batteryPower: (p.battery?.voltage ?? 0) * (p.battery?.current ?? 0),
      fuelCellPower: (p.fuelCell?.voltage ?? 0) * (p.fuelCell?.current ?? 0),
      commonBusPower: (p.dcBus?.voltage ?? 0) * (p.dcBus?.current ?? 0),
    },
  };
}

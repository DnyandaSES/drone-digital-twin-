/* ────────────────────────────────────────────────────────
   AEROTWIN — TELEMETRY STORE  (Zustand)
   Single source of truth for all live telemetry data.
   Every page/component reads from here — nothing else
   maintains its own UDP listener or independent state.
   ──────────────────────────────────────────────────────── */

import { create } from "zustand";
import type {
  Alert,
  ConnectionStatus,
  Telemetry,
  TelemetryHistory,
  TelemetryPoint,
} from "../types/telemetry";
import { evaluateTelemetryAlerts } from "../lib/thresholds";

/* ── Constants ─────────────────────────────────────────── */

/** Maximum data points kept per history series (~60 s at 2 Hz). */
const MAX_HISTORY = 120;


/* ── Default telemetry snapshot ────────────────────────── */

const DEFAULT_TELEMETRY: Telemetry = {
  timestamp: Date.now(),

  flight: { altitude: 0, speed: 0, roll: 0, pitch: 0, yaw: 0 },
  gps: { latitude: 0, longitude: 0, satellites: 0 },
  battery:  { voltage: 0, current: 0, percentage: 0, temperature: 0 },
  fuelCell: { voltage: 0, current: 0, temperature: 0, tankPercentage: 0, pressure: 0 },
  dcBus:    { voltage: 0, current: 0 },
  signal:   { rssi: 0 },
  motor:    { power: 0 },
  masterPcb: {
    throttle: 0,
    valveOpen: false,
    r1Resistance: 62.0,
    r2Resistance: 60.0,
    batteryPower: 0,
    fuelCellPower: 0,
    commonBusPower: 0,
  },
};

function emptyHistory(): TelemetryHistory {
  return {
    altitude: [],
    speed: [],
    batteryVoltage: [],
    batteryCurrent: [],
    fuelCellVoltage: [],
    fuelCellCurrent: [],
    dcBusVoltage: [],
    dcBusCurrent: [],
    motorPower: [],
    rssi: [],
    throttle: [],
  };
}


/* ── Store shape ───────────────────────────────────────── */

export interface TelemetryStore {
  /** Latest complete telemetry snapshot. */
  current: Telemetry;

  /** Rolling time-series windows for charts. */
  history: TelemetryHistory;

  /** UDP connection status. */
  connectionStatus: ConnectionStatus;

  /** When the current mission started (epoch ms). */
  missionStartTime: number;

  /** Active / recent alerts. */
  alerts: Alert[];

  /* ── Actions ─────────────────────────────────────────── */

  /** Push a new telemetry snapshot; automatically appends to history. */
  updateTelemetry: (t: Telemetry) => void;

  /** Set UDP connection status. */
  setConnectionStatus: (s: ConnectionStatus) => void;

  /** Replace the alerts list. */
  setAlerts: (a: Alert[]) => void;

  /** Reset mission timer to now. */
  resetMission: () => void;
}


/* ── Helpers ───────────────────────────────────────────── */

function pushPoint(
  series: TelemetryPoint[],
  time: number,
  value: number,
): TelemetryPoint[] {
  const next = [...series, { time, value }];
  return next.length > MAX_HISTORY ? next.slice(-MAX_HISTORY) : next;
}


/* ── Create store ──────────────────────────────────────── */

export const useTelemetryStore = create<TelemetryStore>((set) => ({
  current: DEFAULT_TELEMETRY,
  history: emptyHistory(),
  connectionStatus: "disconnected",
  missionStartTime: Date.now(),
  alerts: [],

  updateTelemetry: (t) =>
    set((state) => {
      const elapsed = (t.timestamp - state.missionStartTime) / 1000;
      const rawMotor = t.motor as unknown;
      const motorPowerVal =
        typeof rawMotor === "number"
          ? rawMotor
          : t.motor?.power ?? (t.battery.voltage * t.battery.current + t.fuelCell.voltage * t.fuelCell.current);

      const newAlerts = evaluateTelemetryAlerts(t);

      return {
        current: t,
        alerts: newAlerts,
        history: {
          altitude:        pushPoint(state.history.altitude,        elapsed, t.flight.altitude),
          speed:           pushPoint(state.history.speed,           elapsed, t.flight.speed),
          batteryVoltage:  pushPoint(state.history.batteryVoltage,  elapsed, t.battery.voltage),
          batteryCurrent:  pushPoint(state.history.batteryCurrent,  elapsed, t.battery.current),
          fuelCellVoltage: pushPoint(state.history.fuelCellVoltage, elapsed, t.fuelCell.voltage),
          fuelCellCurrent: pushPoint(state.history.fuelCellCurrent, elapsed, t.fuelCell.current),
          dcBusVoltage:    pushPoint(state.history.dcBusVoltage,    elapsed, t.dcBus.voltage),
          dcBusCurrent:    pushPoint(state.history.dcBusCurrent,    elapsed, t.dcBus.current),
          motorPower:      pushPoint(state.history.motorPower,      elapsed, motorPowerVal),
          rssi:            pushPoint(state.history.rssi,            elapsed, t.signal.rssi),
          throttle:        pushPoint(state.history.throttle,        elapsed, t.masterPcb?.throttle ?? 0),
        },
      };
    }),

  setConnectionStatus: (s) =>
    set((state) => ({
      connectionStatus: s,
      missionStartTime: s === "disconnected" ? Date.now() : state.missionStartTime,
    })),

  setAlerts: (a) => set({ alerts: a }),

  resetMission: () =>
    set({ missionStartTime: Date.now(), history: emptyHistory() }),
}));

/* ────────────────────────────────────────────────────────
   AEROTWIN — STATUS THRESHOLDS
   Defines nominal / caution / critical boundaries for
   each telemetry subsystem. Dynamically backed by settingsStore.
   ──────────────────────────────────────────────────────── */

import type { AlertSeverity } from "../types/telemetry";
import { useSettingsStore } from "../store/settingsStore";


/* ── Dynamic Threshold Getters ─────────────────────────── */

export const BATTERY_THRESHOLDS = {
  get percentage() {
    let s;
    try {
      s = useSettingsStore.getState();
    } catch {
      s = null;
    }
    return {
      caution: s?.batteryCautionPercent ?? 30,
      critical: s?.batteryCriticalPercent ?? 15,
    };
  },
  voltage: { caution: 11.5, critical: 10.5 },
  temperature: { caution: 55, critical: 65 },
};

export const FUEL_CELL_THRESHOLDS = {
  voltage: { caution: 12.0, critical: 10.0 },
  get temperature() {
    let s;
    try {
      s = useSettingsStore.getState();
    } catch {
      s = null;
    }
    const crit = s?.fuelCellMaxTemp ?? 75;
    return {
      caution: Math.max(40, crit - 10),
      critical: crit,
    };
  },
};

export const DC_BUS_THRESHOLDS = {
  voltage: { low: 44.0, high: 58.0 },
  current: { caution: 45, critical: 55 },
} as const;

export const SIGNAL_THRESHOLDS = {
  get rssi() {
    let s;
    try {
      s = useSettingsStore.getState();
    } catch {
      s = null;
    }
    const caution = s?.signalRssiThreshold ?? -75;
    return {
      caution,
      critical: Math.min(-85, caution - 10),
    };
  },
};

export const BUS_VOLTAGE_RANGE = { min: 40, max: 60 } as const;
export const BUS_CURRENT_RANGE = { min: 0, max: 60 } as const;


/**
 * Evaluates a complete telemetry snapshot and generates an array of active alerts
 * using user-configured settingsStore safety thresholds.
 */
export function evaluateTelemetryAlerts(
  t: import("../types/telemetry").Telemetry
): import("../types/telemetry").Alert[] {
  const alerts: import("../types/telemetry").Alert[] = [];
  const now = t.timestamp || Date.now();

  const batCaution = BATTERY_THRESHOLDS.percentage.caution;
  const batCritical = BATTERY_THRESHOLDS.percentage.critical;

  const fcCaution = FUEL_CELL_THRESHOLDS.temperature.caution;
  const fcCritical = FUEL_CELL_THRESHOLDS.temperature.critical;

  const rssiCaution = SIGNAL_THRESHOLDS.rssi.caution;
  const rssiCritical = SIGNAL_THRESHOLDS.rssi.critical;

  // Battery percentage checks
  if (t.battery.percentage <= batCritical) {
    alerts.push({
      id: `bat-pct-crit-${now}`,
      severity: "critical",
      source: "Battery",
      message: `CRITICAL: Battery level at ${t.battery.percentage.toFixed(1)}% (Limit: ${batCritical}%)`,
      timestamp: now,
    });
  } else if (t.battery.percentage <= batCaution) {
    alerts.push({
      id: `bat-pct-caut-${now}`,
      severity: "caution",
      source: "Battery",
      message: `CAUTION: Low battery level at ${t.battery.percentage.toFixed(1)}% (Limit: ${batCaution}%)`,
      timestamp: now,
    });
  }

  if (t.battery.temperature >= BATTERY_THRESHOLDS.temperature.critical) {
    alerts.push({
      id: `bat-temp-crit-${now}`,
      severity: "critical",
      source: "Battery",
      message: `CRITICAL: Battery temperature high (${t.battery.temperature.toFixed(1)}°C)`,
      timestamp: now,
    });
  } else if (t.battery.temperature >= BATTERY_THRESHOLDS.temperature.caution) {
    alerts.push({
      id: `bat-temp-caut-${now}`,
      severity: "caution",
      source: "Battery",
      message: `CAUTION: Battery temp elevated (${t.battery.temperature.toFixed(1)}°C)`,
      timestamp: now,
    });
  }

  // Fuel Cell checks
  if (t.fuelCell.temperature >= fcCritical) {
    alerts.push({
      id: `fc-temp-crit-${now}`,
      severity: "critical",
      source: "Fuel Cell",
      message: `CRITICAL: Fuel Cell temperature critical (${t.fuelCell.temperature.toFixed(1)}°C, Limit: ${fcCritical}°C)`,
      timestamp: now,
    });
  } else if (t.fuelCell.temperature >= fcCaution) {
    alerts.push({
      id: `fc-temp-caut-${now}`,
      severity: "caution",
      source: "Fuel Cell",
      message: `CAUTION: Fuel Cell temperature elevated (${t.fuelCell.temperature.toFixed(1)}°C)`,
      timestamp: now,
    });
  }

  // Signal / Comms checks
  if (t.signal.rssi <= rssiCritical) {
    alerts.push({
      id: `rssi-crit-${now}`,
      severity: "critical",
      source: "Radio / Comms",
      message: `CRITICAL: Radio signal extremely weak (${t.signal.rssi} dBm)`,
      timestamp: now,
    });
  } else if (t.signal.rssi <= rssiCaution) {
    alerts.push({
      id: `rssi-caut-${now}`,
      severity: "caution",
      source: "Radio / Comms",
      message: `CAUTION: Radio signal degradation (${t.signal.rssi} dBm, Limit: ${rssiCaution} dBm)`,
      timestamp: now,
    });
  }

  return alerts;
}

/**
 * Returns severity based on a value and thresholds where
 * LOWER values are worse (e.g. battery %, voltage, RSSI).
 */
export function getSeverityBelow(
  value: number,
  caution: number,
  critical: number
): AlertSeverity {
  if (value <= critical) return "critical";
  if (value <= caution) return "caution";
  return "nominal";
}

/**
 * Returns severity based on a value where HIGHER values
 * are worse (e.g. temperature, current).
 */
export function getSeverityAbove(
  value: number,
  caution: number,
  critical: number
): AlertSeverity {
  if (value >= critical) return "critical";
  if (value >= caution) return "caution";
  return "nominal";
}

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SettingsState {
  // Telemetry & Network
  udpPort: number;
  watchdogTimeoutMs: number;
  autoReconnect: boolean;

  // Safety & Alerts
  batteryCautionPercent: number;
  batteryCriticalPercent: number;
  fuelCellMaxTemp: number;
  signalRssiThreshold: number;

  // 3D Viewport / Digital Twin
  showRadarGrid: boolean;
  autoRotateDrone: boolean;
  rotationSpeed: number;
  lightingIntensity: number;
  cameraFov: number;

  // Units
  speedUnit: "m/s" | "km/h" | "knots";
  altitudeUnit: "m" | "ft";
  tempUnit: "°C" | "°F";

  // Setters
  setUdpPort: (port: number) => void;
  setWatchdogTimeoutMs: (ms: number) => void;
  setAutoReconnect: (val: boolean) => void;

  setBatteryCautionPercent: (val: number) => void;
  setBatteryCriticalPercent: (val: number) => void;
  setFuelCellMaxTemp: (val: number) => void;
  setSignalRssiThreshold: (val: number) => void;

  setShowRadarGrid: (val: boolean) => void;
  setAutoRotateDrone: (val: boolean) => void;
  setRotationSpeed: (val: number) => void;
  setLightingIntensity: (val: number) => void;
  setCameraFov: (val: number) => void;

  setSpeedUnit: (unit: "m/s" | "km/h" | "knots") => void;
  setAltitudeUnit: (unit: "m" | "ft") => void;
  setTempUnit: (unit: "°C" | "°F") => void;

  updateSettings: (partial: Partial<SettingsState>) => void;
  resetToDefaults: () => void;
}

export const DEFAULT_SETTINGS = {
  udpPort: 8888,
  watchdogTimeoutMs: 3500,
  autoReconnect: true,

  batteryCautionPercent: 30,
  batteryCriticalPercent: 15,
  fuelCellMaxTemp: 75,
  signalRssiThreshold: -75,

  showRadarGrid: true,
  autoRotateDrone: false,
  rotationSpeed: 1.0,
  lightingIntensity: 1.0,
  cameraFov: 50,

  speedUnit: "m/s" as const,
  altitudeUnit: "m" as const,
  tempUnit: "°C" as const,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setUdpPort: (udpPort) => set({ udpPort }),
      setWatchdogTimeoutMs: (watchdogTimeoutMs) => set({ watchdogTimeoutMs }),
      setAutoReconnect: (autoReconnect) => set({ autoReconnect }),

      setBatteryCautionPercent: (batteryCautionPercent) => set({ batteryCautionPercent }),
      setBatteryCriticalPercent: (batteryCriticalPercent) => set({ batteryCriticalPercent }),
      setFuelCellMaxTemp: (fuelCellMaxTemp) => set({ fuelCellMaxTemp }),
      setSignalRssiThreshold: (signalRssiThreshold) => set({ signalRssiThreshold }),

      setShowRadarGrid: (showRadarGrid) => set({ showRadarGrid }),
      setAutoRotateDrone: (autoRotateDrone) => set({ autoRotateDrone }),
      setRotationSpeed: (rotationSpeed) => set({ rotationSpeed }),
      setLightingIntensity: (lightingIntensity) => set({ lightingIntensity }),
      setCameraFov: (cameraFov) => set({ cameraFov }),

      setSpeedUnit: (speedUnit) => set({ speedUnit }),
      setAltitudeUnit: (altitudeUnit) => set({ altitudeUnit }),
      setTempUnit: (tempUnit) => set({ tempUnit }),

      updateSettings: (partial) => set(partial),
      resetToDefaults: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: "aerotwin-settings",
    }
  )
);

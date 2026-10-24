/* ────────────────────────────────────────────────────────
   AEROTWIN — SETTINGS & SYSTEM CONFIGURATION PAGE
   Telemetry receiver, 3D Digital Twin Viewport, safety boundaries,
   display unit preferences, and persistent local configuration.
   ──────────────────────────────────────────────────────── */

import { useEffect, useState } from "react";
import {
  Box,
  Check,
  Cpu,
  Monitor,
  Radio,
  RefreshCw,
  RotateCcw,
  Settings as SettingsIcon,
  ShieldAlert,
  X,
} from "lucide-react";

import { useTheme } from "../hooks/useTheme";
import { useTelemetryStore } from "../store/telemetryStore";
import { useSettingsStore } from "../store/settingsStore";
import { updateBackendUdpPort } from "../lib/tauriCommands";
import styles from "./Settings.module.css";


export default function Settings() {
  const { theme, setTheme } = useTheme();
  const resetMission = useTelemetryStore((s) => s.resetMission);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");

  // Global settings store
  const settings = useSettingsStore();

  // Local state confirmation modal & toast
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Auto-dismiss notification toast after 4 seconds
  useEffect(() => {
    if (toastMsg) {
      const timer = setTimeout(() => setToastMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMsg]);

  const handleSave = async () => {
    const res = await updateBackendUdpPort(settings.udpPort);
    if (res.success) {
      setToastMsg(`Preferences saved! Backend UDP receiver bound to port ${settings.udpPort}.`);
    } else {
      setToastMsg(`Preferences saved (local). Note: ${res.message}`);
    }
  };

  const handleRestoreDefaults = async () => {
    settings.resetToDefaults();
    await updateBackendUdpPort(8888);
    setToastMsg("Settings restored to factory defaults (UDP port 8888).");
  };

  const handleUdpPortChange = async (newPort: number) => {
    settings.setUdpPort(newPort);
    const res = await updateBackendUdpPort(newPort);
    if (res.success) {
      setToastMsg(res.message);
    }
  };

  const handleConfirmResetTelemetry = () => {
    resetMission();
    setShowResetConfirm(false);
    setToastMsg("Session telemetry history & mission clock reset.");
  };

  return (
    <div className={styles.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <SettingsIcon size={22} color="var(--accent-cyan)" />
          <div>
            <h1 className="text-page-title">SYSTEM SETTINGS</h1>
            <span className={styles.subtitle}>
              Telemetry connection, 3D viewport parameters, safety boundaries, and display preferences
            </span>
          </div>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.btn} onClick={handleRestoreDefaults} title="Reset all settings to default values">
            <RotateCcw size={14} /> RESTORE DEFAULTS
          </button>
          <button className={styles.btnPrimary} onClick={handleSave} title="Save current settings">
            <Check size={14} /> SAVE PREFERENCES
          </button>
        </div>
      </div>

      {toastMsg && (
        <div
          style={{
            padding: "10px 16px",
            background: "rgba(62, 207, 142, 0.15)",
            color: "var(--status-nominal)",
            border: "1px solid rgba(62, 207, 142, 0.3)",
            borderRadius: 6,
            font: "var(--type-caption)",
            fontWeight: 600,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{toastMsg}</span>
          <button
            onClick={() => setToastMsg(null)}
            style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center" }}
            title="Dismiss"
          >
            <X size={14} color="var(--status-nominal)" />
          </button>
        </div>
      )}

      {/* ── 1. Telemetry Receiver & Network ───────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Radio size={16} color="var(--accent-cyan)" /> TELEMETRY RECEIVER & NETWORK
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>UDP Receiver Port</span>
            <span className={styles.labelDesc}>Port used by ESP32 / WiFiUDP broadcast receiver (Default: 8888)</span>
          </div>
          <input
            type="number"
            className={styles.input}
            value={settings.udpPort}
            onChange={(e) => handleUdpPortChange(Number(e.target.value) || 8888)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Watchdog Disconnect Timeout</span>
            <span className={styles.labelDesc}>Inactivity period before declaring telemetry connection timeout</span>
          </div>
          <div className={styles.controlGroup}>
            <input
              type="number"
              className={styles.input}
              value={settings.watchdogTimeoutMs}
              onChange={(e) => settings.setWatchdogTimeoutMs(Number(e.target.value) || 3500)}
            />
            <span style={{ font: "var(--type-caption)", color: "var(--text-instrument)" }}>ms</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Socket Connection Status</span>
            <span className={styles.labelDesc}>Backend Rust UDP listener socket thread</span>
          </div>
          <span
            style={{
              font: "var(--type-caption)",
              fontWeight: 600,
              color: connected ? "var(--status-nominal)" : "var(--status-critical)",
            }}
          >
            {connected ? `BOUND TO 0.0.0.0:${settings.udpPort} — RECEIVING` : "DISCONNECTED"}
          </span>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Auto-Reconnect on Packet Loss</span>
            <span className={styles.labelDesc}>Automatically attempt socket re-bind if link drops</span>
          </div>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={settings.autoReconnect}
              onChange={(e) => settings.setAutoReconnect(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </label>
        </div>
      </div>

      {/* ── 2. 3D Viewport & Digital Twin Controls ────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Box size={16} color="var(--accent-cyan)" /> 3D VIEWPORT & DIGITAL TWIN CONTROLS
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Radar Grid Visibility</span>
            <span className={styles.labelDesc}>Show or hide the radar floor grid in the 3D viewport</span>
          </div>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={settings.showRadarGrid}
              onChange={(e) => settings.setShowRadarGrid(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </label>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Auto-Rotate Camera</span>
            <span className={styles.labelDesc}>Continuously orbit camera around 3D drone model</span>
          </div>
          <label className={styles.switchLabel}>
            <input
              type="checkbox"
              className={styles.switchInput}
              checked={settings.autoRotateDrone}
              onChange={(e) => settings.setAutoRotateDrone(e.target.checked)}
            />
            <span className={styles.switchTrack} />
          </label>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Orbit Rotation Speed</span>
            <span className={styles.labelDesc}>Speed multiplier for automatic camera rotation</span>
          </div>
          <div className={styles.rangeWrapper}>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              className={styles.rangeInput}
              value={settings.rotationSpeed}
              onChange={(e) => settings.setRotationSpeed(Number(e.target.value))}
            />
            <span className={styles.rangeValue}>{settings.rotationSpeed.toFixed(1)}x</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Scene Lighting Brightness</span>
            <span className={styles.labelDesc}>Adjust 3D directional & ambient light intensity</span>
          </div>
          <div className={styles.rangeWrapper}>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              className={styles.rangeInput}
              value={settings.lightingIntensity}
              onChange={(e) => settings.setLightingIntensity(Number(e.target.value))}
            />
            <span className={styles.rangeValue}>{Math.round(settings.lightingIntensity * 100)}%</span>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Camera Field of View (FOV)</span>
            <span className={styles.labelDesc}>Perspective camera angle width (Default: 50°)</span>
          </div>
          <div className={styles.rangeWrapper}>
            <input
              type="range"
              min="30"
              max="90"
              step="5"
              className={styles.rangeInput}
              value={settings.cameraFov}
              onChange={(e) => settings.setCameraFov(Number(e.target.value))}
            />
            <span className={styles.rangeValue}>{settings.cameraFov}°</span>
          </div>
        </div>
      </div>

      {/* ── 3. Appearance & Unit Systems ────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Monitor size={16} color="var(--accent-cyan)" /> APPEARANCE & DISPLAY UNITS
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>UI Color Theme</span>
            <span className={styles.labelDesc}>Switch between Dark Hangar and Light Field instrument themes</span>
          </div>
          <div className={styles.segmentGroup}>
            <button
              className={`${styles.segmentBtn} ${theme === "system" ? styles.segmentBtnActive : ""}`}
              onClick={() => setTheme("system")}
            >
              SYSTEM
            </button>
            <button
              className={`${styles.segmentBtn} ${theme === "dark" ? styles.segmentBtnActive : ""}`}
              onClick={() => setTheme("dark")}
            >
              DARK HANGAR
            </button>
            <button
              className={`${styles.segmentBtn} ${theme === "light" ? styles.segmentBtnActive : ""}`}
              onClick={() => setTheme("light")}
            >
              LIGHT FIELD
            </button>
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>System Speed Unit</span>
            <span className={styles.labelDesc}>Configured telemetry airspeed & groundspeed metric</span>
          </div>
          <span style={{ font: "var(--type-caption)", color: "var(--text-canopy)", fontWeight: 600, background: "var(--bg-panel-raised)", padding: "6px 12px", borderRadius: "var(--button-radius)", border: "1px solid var(--line-rivet)" }}>
            m/s (Meters per second)
          </span>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>System Altitude Unit</span>
            <span className={styles.labelDesc}>Configured barometric altitude metric</span>
          </div>
          <span style={{ font: "var(--type-caption)", color: "var(--text-canopy)", fontWeight: 600, background: "var(--bg-panel-raised)", padding: "6px 12px", borderRadius: "var(--button-radius)", border: "1px solid var(--line-rivet)" }}>
            m (Meters)
          </span>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>System Temperature Unit</span>
            <span className={styles.labelDesc}>Configured fuel cell & stack thermal metric</span>
          </div>
          <span style={{ font: "var(--type-caption)", color: "var(--text-canopy)", fontWeight: 600, background: "var(--bg-panel-raised)", padding: "6px 12px", borderRadius: "var(--button-radius)", border: "1px solid var(--line-rivet)" }}>
            °C (Celsius)
          </span>
        </div>
      </div>

      {/* ── 4. Safety Thresholds & Alerts ────────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <ShieldAlert size={16} color="var(--status-caution)" /> SAFETY THRESHOLDS & ALERTS
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Low Battery Caution Level (%)</span>
            <span className={styles.labelDesc}>Triggers warning alert when battery drops below threshold</span>
          </div>
          <input
            type="number"
            className={styles.input}
            value={settings.batteryCautionPercent}
            onChange={(e) => settings.setBatteryCautionPercent(Number(e.target.value) || 30)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Critical Battery Threshold (%)</span>
            <span className={styles.labelDesc}>Triggers emergency warning level for battery percentage</span>
          </div>
          <input
            type="number"
            className={styles.input}
            value={settings.batteryCriticalPercent}
            onChange={(e) => settings.setBatteryCriticalPercent(Number(e.target.value) || 15)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Fuel Cell Over-Temp Limit (°C)</span>
            <span className={styles.labelDesc}>Thermal shutdown limit for fuel cell stack temperature</span>
          </div>
          <input
            type="number"
            className={styles.input}
            value={settings.fuelCellMaxTemp}
            onChange={(e) => settings.setFuelCellMaxTemp(Number(e.target.value) || 75)}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Radio Signal Warning (RSSI dBm)</span>
            <span className={styles.labelDesc}>Triggers signal degradation warning below this dBm level</span>
          </div>
          <input
            type="number"
            className={styles.input}
            value={settings.signalRssiThreshold}
            onChange={(e) => settings.setSignalRssiThreshold(Number(e.target.value) || -75)}
          />
        </div>
      </div>

      {/* ── 5. System Operations & Data Reset ─────────────── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          <Cpu size={16} color="var(--accent-cyan)" /> SYSTEM OPERATIONS & DATA RESET
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>AeroTwin Client Build</span>
            <span className={styles.labelDesc}>Tauri + React 19 Digital Twin Telemetry Client</span>
          </div>
          <span style={{ font: "var(--type-caption)", color: "var(--text-instrument)", fontWeight: 600 }}>
            v0.1.0 (Production)
          </span>
        </div>

        <div className={styles.row}>
          <div className={styles.labelGroup}>
            <span className={styles.labelName}>Reset Session Telemetry</span>
            <span className={styles.labelDesc}>Clears history arrays and resets mission clock to zero</span>
          </div>
          {!showResetConfirm ? (
            <button className={styles.btnDanger} onClick={() => setShowResetConfirm(true)}>
              <RefreshCw size={13} /> RESET MISSION DATA
            </button>
          ) : (
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ font: "var(--type-caption)", color: "var(--status-critical)", fontWeight: 600 }}>
                CONFIRM RESET?
              </span>
              <button
                className={styles.btnDanger}
                style={{ background: "var(--status-critical)", color: "#fff" }}
                onClick={handleConfirmResetTelemetry}
              >
                YES, RESET
              </button>
              <button className={styles.btn} onClick={() => setShowResetConfirm(false)}>
                CANCEL
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

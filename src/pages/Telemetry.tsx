/* ────────────────────────────────────────────────────────
   AEROTWIN — TELEMETRY DEEP DIVE PAGE
   Comprehensive time-series, metric breakdown, telemetry data
   exporting, and timed telemetry frame recording.
   ──────────────────────────────────────────────────────── */

import { useEffect, useRef, useState } from "react";
import { Circle, Download, FileSpreadsheet, Square, Terminal, Timer, Trash2, Waypoints, X } from "lucide-react";
import * as XLSX from "xlsx";

import InstrumentCard from "../components/common/InstrumentCard";
import TelemetryLineChart from "../charts/TelemetryLineChart";
import { useTelemetryStore } from "../store/telemetryStore";
import type { Telemetry, TelemetryPoint } from "../types/telemetry";

import styles from "./Telemetry.module.css";


type CategoryTab = "ALL" | "FLIGHT" | "GPS" | "BATTERY" | "FUEL_CELL" | "DC_BUS" | "COMMS";

function calcStats(history: TelemetryPoint[], currentVal: number) {
  if (history.length === 0) return { min: currentVal, max: currentVal, avg: currentVal };
  const vals = history.map((p) => p.value);
  const min = Math.min(...vals, currentVal);
  const max = Math.max(...vals, currentVal);
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  return { min, max, avg };
}


export default function Telemetry() {
  const [activeTab, setActiveTab] = useState<CategoryTab>("ALL");
  const [showRawJson, setShowRawJson] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  // Auto-dismiss notification toast after 5 seconds
  useEffect(() => {
    if (downloadMsg) {
      const timer = setTimeout(() => setDownloadMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadMsg]);

  // Timed Recorder State
  const [recordSeconds, setRecordSeconds] = useState<number>(30);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [secondsLeft, setSecondsLeft] = useState<number>(0);
  const [recordedFrames, setRecordedFrames] = useState<Telemetry[]>([]);
  const [recordingFinished, setRecordingFinished] = useState<boolean>(false);

  const current = useTelemetryStore((s) => s.current);
  const history = useTelemetryStore((s) => s.history);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");
  const missionStartTime = useTelemetryStore((s) => s.missionStartTime);

  // Buffer incoming frames during recording
  const recordedFramesRef = useRef<Telemetry[]>([]);

  // Capture incoming telemetry snapshots when recording is active
  useEffect(() => {
    if (isRecording && current) {
      recordedFramesRef.current.push(current);
    }
  }, [current, isRecording]);

  // Timed Recording Countdown
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isRecording && secondsLeft > 0) {
      interval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            // Stop recording when duration reached
            setIsRecording(false);
            setRecordingFinished(true);
            setRecordedFrames([...recordedFramesRef.current]);
            setDownloadMsg(`Recording complete! Captured ${recordedFramesRef.current.length} telemetry frames.`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, secondsLeft]);

  // Start Timed Recording
  const startRecording = () => {
    recordedFramesRef.current = [];
    setRecordedFrames([]);
    setRecordingFinished(false);
    setSecondsLeft(recordSeconds);
    setIsRecording(true);
    setDownloadMsg(`Started recording telemetry for ${recordSeconds} seconds...`);
  };

  // Manual Stop Recording
  const stopRecording = () => {
    setIsRecording(false);
    setRecordingFinished(true);
    setRecordedFrames([...recordedFramesRef.current]);
    setDownloadMsg(`Recording stopped! Captured ${recordedFramesRef.current.length} telemetry frames.`);
  };

  // Clear / Discard Recorded Frames
  const clearRecording = () => {
    recordedFramesRef.current = [];
    setRecordedFrames([]);
    setRecordingFinished(false);
    setIsRecording(false);
    setSecondsLeft(0);
    setDownloadMsg("Recorded frames cleared. Ready to start new recording.");
  };

  // Helper: Export Telemetry Snapshots to Excel (.xlsx)
  const exportSnapshotsToExcel = (frames: Telemetry[], filename: string) => {
    const wb = XLSX.utils.book_new();

    const data = frames.map((f) => ({
      "Timestamp (Local)": new Date(f.timestamp).toLocaleTimeString(),
      "Epoch Ms": f.timestamp,
      "Altitude (m)": f.flight.altitude,
      "Airspeed (m/s)": f.flight.speed,
      "Roll (deg)": f.flight.roll,
      "Pitch (deg)": f.flight.pitch,
      "Yaw (deg)": f.flight.yaw,
      "GPS Latitude": f.gps.latitude,
      "GPS Longitude": f.gps.longitude,
      "GPS Satellites": f.gps.satellites,
      "Battery Voltage (V)": f.battery.voltage,
      "Battery Current (A)": f.battery.current,
      "Battery Level (%)": f.battery.percentage,
      "Battery Temp (C)": f.battery.temperature,
      "Fuel Cell Voltage (V)": f.fuelCell.voltage,
      "Fuel Cell Current (A)": f.fuelCell.current,
      "Fuel Cell Temp (C)": f.fuelCell.temperature,
      "Fuel Cell Tank (%)": f.fuelCell.tankPercentage,
      "Fuel Cell Pressure (bar)": f.fuelCell.pressure,
      "DC Bus Voltage (V)": f.dcBus.voltage,
      "DC Bus Current (A)": f.dcBus.current,
      "Motor Power (W)": f.motor?.power ?? 0,
      "RSSI (dBm)": f.signal.rssi,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Telemetry Frames");
    XLSX.writeFile(wb, filename);

    setDownloadMsg(`Exported ${frames.length} frames to ${filename}`);
  };

  // Helper: Export Telemetry Snapshots to CSV
  const exportSnapshotsToCSV = (frames: Telemetry[], filename: string) => {
    let csv = "Timestamp,EpochMs,Altitude(m),Airspeed(m/s),Roll(deg),Pitch(deg),Yaw(deg),Latitude,Longitude,Satellites,BatVoltage(V),BatCurrent(A),BatLevel(%),BatTemp(C),FCVoltage(V),FCCurrent(A),FCTemp(C),FCTank(%),FCPressure(bar),DCBusVoltage(V),DCBusCurrent(A),MotorPower(W),RSSI(dBm)\n";

    frames.forEach((f) => {
      csv += `${new Date(f.timestamp).toLocaleTimeString()},${f.timestamp},${f.flight.altitude.toFixed(2)},${f.flight.speed.toFixed(2)},${f.flight.roll.toFixed(1)},${f.flight.pitch.toFixed(1)},${f.flight.yaw.toFixed(1)},${f.gps.latitude.toFixed(6)},${f.gps.longitude.toFixed(6)},${f.gps.satellites},${f.battery.voltage.toFixed(2)},${f.battery.current.toFixed(2)},${f.battery.percentage.toFixed(1)},${f.battery.temperature.toFixed(1)},${f.fuelCell.voltage.toFixed(2)},${f.fuelCell.current.toFixed(2)},${f.fuelCell.temperature.toFixed(1)},${f.fuelCell.tankPercentage.toFixed(1)},${f.fuelCell.pressure.toFixed(1)},${f.dcBus.voltage.toFixed(2)},${f.dcBus.current.toFixed(2)},${(f.motor?.power ?? 0).toFixed(1)},${f.signal.rssi}\n`;
    });

    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csv);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();

    setDownloadMsg(`Exported CSV file: ${filename}`);
  };

  // Export ALL received telemetry from history
  const handleExportAllExcel = () => {
    const len = history.altitude.length;
    const frames: Telemetry[] = [];
    for (let i = 0; i < len; i++) {
      frames.push({
        timestamp: missionStartTime + (history.altitude[i]?.time ?? 0) * 1000,
        flight: {
          altitude: history.altitude[i]?.value ?? 0,
          speed: history.speed[i]?.value ?? 0,
          roll: current.flight.roll,
          pitch: current.flight.pitch,
          yaw: current.flight.yaw,
        },
        gps: current.gps,
        battery: {
          voltage: history.batteryVoltage[i]?.value ?? 0,
          current: history.batteryCurrent[i]?.value ?? 0,
          percentage: current.battery.percentage,
          temperature: current.battery.temperature,
        },
        fuelCell: {
          voltage: history.fuelCellVoltage[i]?.value ?? 0,
          current: history.fuelCellCurrent[i]?.value ?? 0,
          temperature: current.fuelCell.temperature,
          tankPercentage: current.fuelCell.tankPercentage,
          pressure: current.fuelCell.pressure,
        },
        dcBus: {
          voltage: history.dcBusVoltage[i]?.value ?? 0,
          current: history.dcBusCurrent[i]?.value ?? 0,
        },
        signal: { rssi: history.rssi[i]?.value ?? 0 },
        motor: { power: history.motorPower[i]?.value ?? 0 },
      });
    }
    exportSnapshotsToExcel(frames.length > 0 ? frames : [current], `AeroTwin_All_Telemetry_${Date.now()}.xlsx`);
  };

  const handleExportAllCSV = () => {
    const len = history.altitude.length;
    const frames: Telemetry[] = [];
    for (let i = 0; i < len; i++) {
      frames.push({
        timestamp: missionStartTime + (history.altitude[i]?.time ?? 0) * 1000,
        flight: {
          altitude: history.altitude[i]?.value ?? 0,
          speed: history.speed[i]?.value ?? 0,
          roll: current.flight.roll,
          pitch: current.flight.pitch,
          yaw: current.flight.yaw,
        },
        gps: current.gps,
        battery: {
          voltage: history.batteryVoltage[i]?.value ?? 0,
          current: history.batteryCurrent[i]?.value ?? 0,
          percentage: current.battery.percentage,
          temperature: current.battery.temperature,
        },
        fuelCell: {
          voltage: history.fuelCellVoltage[i]?.value ?? 0,
          current: history.fuelCellCurrent[i]?.value ?? 0,
          temperature: current.fuelCell.temperature,
          tankPercentage: current.fuelCell.tankPercentage,
          pressure: current.fuelCell.pressure,
        },
        dcBus: {
          voltage: history.dcBusVoltage[i]?.value ?? 0,
          current: history.dcBusCurrent[i]?.value ?? 0,
        },
        signal: { rssi: history.rssi[i]?.value ?? 0 },
        motor: { power: history.motorPower[i]?.value ?? 0 },
      });
    }
    exportSnapshotsToCSV(frames.length > 0 ? frames : [current], `AeroTwin_All_Telemetry_${Date.now()}.csv`);
  };

  const isTabVisible = (tab: CategoryTab) => activeTab === "ALL" || activeTab === tab;

  return (
    <div className={styles.container}>
      {/* ── Page Header ────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Waypoints size={22} color="var(--accent-cyan)" />
          <div>
            <h1 className="text-page-title">TELEMETRY ANALYSIS</h1>
            <span className={styles.subtitle}>Real-time multichannel telemetry streams & data recorder</span>
          </div>
        </div>

        {/* Subsystem Category Filter Tabs */}
        <div className={styles.tabs}>
          {(["ALL", "FLIGHT", "GPS", "BATTERY", "FUEL_CELL", "DC_BUS", "COMMS"] as CategoryTab[]).map((tab) => (
            <button
              key={tab}
              className={`${styles.tab} ${activeTab === tab ? styles.tabActive : ""}`}
              onClick={() => setActiveTab(tab)}
            >
              {tab.replace("_", " ")}
            </button>
          ))}

          <button
            className={`${styles.tab} ${showRawJson ? styles.tabActive : ""}`}
            onClick={() => setShowRawJson(!showRawJson)}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            <Terminal size={12} />
            RAW UDP
          </button>
        </div>
      </div>

      {downloadMsg && (
        <div style={{ padding: "8px 14px", background: "rgba(62, 207, 142, 0.15)", color: "var(--status-nominal)", borderRadius: 4, font: "var(--type-caption)", fontWeight: 600, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>{downloadMsg}</span>
          <button onClick={() => setDownloadMsg(null)} style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center" }} title="Dismiss notification">
            <X size={14} color="var(--status-nominal)" />
          </button>
        </div>
      )}

      {/* ── Toolbar: Telemetry Exporter & Timed Frame Recorder ── */}
      <div className={styles.toolbar}>
        {/* Left: Export All Received Telemetry */}
        <div className={styles.toolbarTitle}>
          <Download size={16} color="var(--accent-cyan)" /> EXPORT ALL RECEIVED TELEMETRY:
          <button className={styles.btn} onClick={handleExportAllExcel} title="Export All Telemetry as Excel (.xlsx)">
            <FileSpreadsheet size={13} /> EXCEL (.XLSX)
          </button>
          <button className={styles.btn} onClick={handleExportAllCSV} title="Export All Telemetry as CSV">
            <Download size={13} /> CSV
          </button>
        </div>

        {/* Right: Timed Telemetry Frame Recorder */}
        <div className={styles.recorderControls}>
          <div className={styles.toolbarTitle}>
            <Timer size={16} color="var(--accent-amber)" /> RECORDER FRAME:
          </div>

          {!isRecording ? (
            <>
              <span style={{ font: "var(--type-caption)", color: "var(--text-instrument)" }}>DURATION (s):</span>
              <input
                type="number"
                min={5}
                max={600}
                className={styles.input}
                value={recordSeconds}
                onChange={(e) => setRecordSeconds(Math.max(5, parseInt(e.target.value) || 10))}
              />
              <button className={`${styles.btn} ${styles.btnRecord}`} onClick={startRecording} title="Start Timed Recording">
                <Circle size={10} fill="currentColor" /> START RECORDING ({recordSeconds}s)
              </button>
            </>
          ) : (
            <>
              <span style={{ font: "var(--type-caption)", fontWeight: 600, color: "var(--status-critical)", display: "flex", alignItems: "center", gap: 6 }}>
                <Circle size={10} fill="currentColor" style={{ animation: "pulse 1s ease-in-out infinite" }} /> RECORDING LIVE... ({secondsLeft}s left)
              </span>
              <button className={`${styles.btn} ${styles.btnRecordActive}`} onClick={stopRecording} title="Stop Recording">
                <Square size={10} fill="currentColor" /> STOP RECORDING
              </button>
            </>
          )}

          {recordingFinished && recordedFrames.length > 0 && !isRecording && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ font: "var(--type-caption)", color: "var(--status-nominal)" }}>
                CAPTURED {recordedFrames.length} FRAMES:
              </span>
              <button
                className={styles.btn}
                onClick={() => exportSnapshotsToExcel(recordedFrames, `Recorded_Telemetry_${recordedFrames.length}frames_${Date.now()}.xlsx`)}
                title="Download Recorded Frames as Excel"
              >
                <FileSpreadsheet size={13} /> RECORDED EXCEL
              </button>
              <button
                className={styles.btn}
                onClick={() => exportSnapshotsToCSV(recordedFrames, `Recorded_Telemetry_${recordedFrames.length}frames_${Date.now()}.csv`)}
                title="Download Recorded Frames as CSV"
              >
                <Download size={13} /> RECORDED CSV
              </button>
              <button
                className={styles.btn}
                onClick={clearRecording}
                style={{ color: "var(--status-critical)", borderColor: "rgba(255, 90, 95, 0.3)" }}
                title="Discard Recorded Frames and Reset Recorder"
              >
                <Trash2 size={13} /> CLEAR RECORDING
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Multi-metric Cards Grid ──────────────────────────── */}
      <div className={styles.grid}>

        {/* Altitude */}
        {isTabVisible("FLIGHT") && (() => {
          const stats = calcStats(history.altitude, current.flight.altitude);
          return (
            <InstrumentCard label="ALTITUDE (M)" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.flight.altitude.toFixed(1)}</span>
                    <span className={styles.statUnit}>m</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(1)}</span>
                    <span>MAX: {stats.max.toFixed(1)}</span>
                    <span>AVG: {stats.avg.toFixed(1)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.altitude} color="var(--accent-cyan)" unit="m" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* Speed */}
        {isTabVisible("FLIGHT") && (() => {
          const stats = calcStats(history.speed, current.flight.speed);
          return (
            <InstrumentCard label="AIRSPEED (M/S)" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.flight.speed.toFixed(1)}</span>
                    <span className={styles.statUnit}>m/s</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(1)}</span>
                    <span>MAX: {stats.max.toFixed(1)}</span>
                    <span>AVG: {stats.avg.toFixed(1)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.speed} color="var(--accent-cyan)" unit="m/s" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* GPS Fix & Satellites */}
        {isTabVisible("GPS") && (
          <InstrumentCard label="GPS NAVIGATION & FIX" live={connected ? "live" : "lost"}>
            <div className={styles.cardBody}>
              <div className={styles.statRow}>
                <div>
                  <span className={styles.statValue}>{current.gps.satellites}</span>
                  <span className={styles.statUnit}>Sats</span>
                </div>
                <div className={styles.subStats}>
                  <span>LAT: {current.gps.latitude.toFixed(6)}°</span>
                  <span>LON: {current.gps.longitude.toFixed(6)}°</span>
                </div>
              </div>
              <div style={{ padding: "12px", background: "var(--surface-sunken)", borderRadius: 6, font: "var(--type-caption)", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-instrument)" }}>LATITUDE:</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", fontWeight: 600 }}>{current.gps.latitude.toFixed(6)}°</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-instrument)" }}>LONGITUDE:</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: "var(--accent-cyan)", fontWeight: 600 }}>{current.gps.longitude.toFixed(6)}°</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-instrument)" }}>SATELLITE LOCK:</span>
                  <span style={{ fontFamily: "var(--font-mono)", color: current.gps.satellites >= 6 ? "var(--status-nominal)" : "var(--status-caution)", fontWeight: 600 }}>{current.gps.satellites >= 6 ? "3D FIX OK" : "ACQUIRING"}</span>
                </div>
              </div>
            </div>
          </InstrumentCard>
        )}

        {/* Battery Voltage */}
        {isTabVisible("BATTERY") && (() => {
          const stats = calcStats(history.batteryVoltage, current.battery.voltage);
          return (
            <InstrumentCard label="BATTERY VOLTAGE" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.battery.voltage.toFixed(2)}</span>
                    <span className={styles.statUnit}>V</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(2)}</span>
                    <span>MAX: {stats.max.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.batteryVoltage} color="var(--accent-cyan)" unit="V" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* Battery Current */}
        {isTabVisible("BATTERY") && (() => {
          const stats = calcStats(history.batteryCurrent, current.battery.current);
          return (
            <InstrumentCard label="BATTERY CURRENT" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.battery.current.toFixed(2)}</span>
                    <span className={styles.statUnit}>A</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MAX: {stats.max.toFixed(2)}</span>
                    <span>AVG: {stats.avg.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.batteryCurrent} color="var(--accent-cyan)" unit="A" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* Fuel Cell Voltage */}
        {isTabVisible("FUEL_CELL") && (() => {
          const stats = calcStats(history.fuelCellVoltage, current.fuelCell.voltage);
          return (
            <InstrumentCard label="FUEL CELL VOLTAGE" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.fuelCell.voltage.toFixed(2)}</span>
                    <span className={styles.statUnit}>V</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(2)}</span>
                    <span>MAX: {stats.max.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.fuelCellVoltage} color="var(--status-nominal)" unit="V" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* Fuel Cell Current */}
        {isTabVisible("FUEL_CELL") && (() => {
          const stats = calcStats(history.fuelCellCurrent, current.fuelCell.current);
          return (
            <InstrumentCard label="FUEL CELL CURRENT" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.fuelCell.current.toFixed(2)}</span>
                    <span className={styles.statUnit}>A</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MAX: {stats.max.toFixed(2)}</span>
                    <span>AVG: {stats.avg.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.fuelCellCurrent} color="var(--status-nominal)" unit="A" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* DC Bus Voltage */}
        {isTabVisible("DC_BUS") && (() => {
          const stats = calcStats(history.dcBusVoltage, current.dcBus.voltage);
          return (
            <InstrumentCard label="DC BUS VOLTAGE" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.dcBus.voltage.toFixed(2)}</span>
                    <span className={styles.statUnit}>V</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(2)}</span>
                    <span>MAX: {stats.max.toFixed(2)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.dcBusVoltage} color="var(--accent-amber)" unit="V" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* Motor Power */}
        {isTabVisible("DC_BUS") && (() => {
          const stats = calcStats(history.motorPower, current.motor?.power ?? 0);
          return (
            <InstrumentCard label="MOTOR POWER OUTPUT" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{(current.motor?.power ?? 0).toFixed(1)}</span>
                    <span className={styles.statUnit}>W</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MAX: {stats.max.toFixed(1)}</span>
                    <span>AVG: {stats.avg.toFixed(1)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.motorPower} color="var(--accent-cyan)" unit="W" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

        {/* RSSI Signal */}
        {isTabVisible("COMMS") && (() => {
          const stats = calcStats(history.rssi, current.signal.rssi);
          return (
            <InstrumentCard label="RADIO RSSI SIGNAL" live={connected ? "live" : "lost"}>
              <div className={styles.cardBody}>
                <div className={styles.statRow}>
                  <div>
                    <span className={styles.statValue}>{current.signal.rssi}</span>
                    <span className={styles.statUnit}>dBm</span>
                  </div>
                  <div className={styles.subStats}>
                    <span>MIN: {stats.min.toFixed(0)}</span>
                    <span>MAX: {stats.max.toFixed(0)}</span>
                  </div>
                </div>
                <div className={styles.chartWrap}>
                  <TelemetryLineChart data={history.rssi} color="var(--accent-amber)" unit="dBm" />
                </div>
              </div>
            </InstrumentCard>
          );
        })()}

      </div>

      {/* ── Raw JSON Stream Drawer ───────────────────────────── */}
      {showRawJson && (
        <div className={styles.rawSection}>
          <div className={styles.rawHeader}>
            <span className={styles.rawTitle}>RAW UDP PAYLOAD STREAM (:8888)</span>
            <span style={{ font: "var(--type-caption)", color: "var(--text-instrument)" }}>
              {connected ? "PACKETS STREAMING LIVE" : "DISCONNECTED"}
            </span>
          </div>
          <pre className={styles.jsonBox}>
            {JSON.stringify(current, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

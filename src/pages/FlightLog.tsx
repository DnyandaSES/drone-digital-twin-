/* ────────────────────────────────────────────────────────
   AEROTWIN — FLIGHT LOG PAGE
   Flight recording, mission stats,
   and Excel (.xlsx) / CSV / JSON log exports.
   ──────────────────────────────────────────────────────── */

import { useEffect, useMemo, useState } from "react";
import { Clock3, Download, FileSpreadsheet, RefreshCw, X } from "lucide-react";
import * as XLSX from "xlsx";

import { useTelemetryStore } from "../store/telemetryStore";
import styles from "./FlightLog.module.css";


export default function FlightLog() {
  const current = useTelemetryStore((s) => s.current);
  const history = useTelemetryStore((s) => s.history);
  const alerts = useTelemetryStore((s) => s.alerts);
  const missionStartTime = useTelemetryStore((s) => s.missionStartTime);
  const resetMission = useTelemetryStore((s) => s.resetMission);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");

  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  // Auto-dismiss notification toast after 5 seconds
  useEffect(() => {
    if (downloadMsg) {
      const timer = setTimeout(() => setDownloadMsg(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [downloadMsg]);

  // Compute flight summary stats
  const stats = useMemo(() => {
    const elapsedSec = Math.max(0, Math.floor((Date.now() - missionStartTime) / 1000));
    const mins = Math.floor(elapsedSec / 60);
    const secs = elapsedSec % 60;

    const alts = history.altitude.map((p) => p.value);
    const maxAlt = alts.length > 0 ? Math.max(...alts, current.flight.altitude) : current.flight.altitude;

    const speeds = history.speed.map((p) => p.value);
    const maxSpeed = speeds.length > 0 ? Math.max(...speeds, current.flight.speed) : current.flight.speed;

    const powers = history.motorPower.map((p) => p.value);
    const peakPower = powers.length > 0 ? Math.max(...powers, current.motor?.power ?? 0) : (current.motor?.power ?? 0);

    return {
      durationStr: `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`,
      maxAlt,
      maxSpeed,
      peakPower,
      dataPoints: history.altitude.length,
    };
  }, [history, current, missionStartTime]);

  // Construct dynamic system logs
  const logEvents = useMemo(() => {
    const events: Array<{ timestamp: string; level: "INFO" | "WARN" | "CRITICAL"; subsystem: string; message: string; value: string }> = [
      {
        timestamp: new Date(missionStartTime).toLocaleTimeString(),
        level: "INFO",
        subsystem: "Telemetry Link",
        message: "UDP Receiver Socket Bound on Port 8888",
        value: "0.0.0.0:8888",
      },
    ];

    if (current.battery.percentage < 30) {
      events.push({
        timestamp: new Date().toLocaleTimeString(),
        level: "WARN",
        subsystem: "Battery",
        message: `Battery level below 30% threshold (${current.battery.percentage.toFixed(1)}%)`,
        value: `${current.battery.percentage.toFixed(1)}%`,
      });
    }

    if (current.fuelCell.temperature > 65) {
      events.push({
        timestamp: new Date().toLocaleTimeString(),
        level: "WARN",
        subsystem: "Fuel Cell",
        message: `Fuel Cell stack temperature elevated (${current.fuelCell.temperature.toFixed(1)}°C)`,
        value: `${current.fuelCell.temperature.toFixed(1)}°C`,
      });
    }

    if (current.signal.rssi < -70) {
      events.push({
        timestamp: new Date().toLocaleTimeString(),
        level: "WARN",
        subsystem: "Radio Signal",
        message: `Signal RSSI degradation (${current.signal.rssi} dBm)`,
        value: `${current.signal.rssi} dBm`,
      });
    }

    // Include dynamic system alerts from store
    alerts.forEach((alt) => {
      events.push({
        timestamp: new Date(alt.timestamp).toLocaleTimeString(),
        level: alt.severity === "critical" ? "CRITICAL" : "WARN",
        subsystem: alt.source,
        message: alt.message,
        value: alt.severity.toUpperCase(),
      });
    });

    events.push({
      timestamp: new Date().toLocaleTimeString(),
      level: "INFO",
      subsystem: "Telemetry Stream",
      message: connected ? "Live Packet Stream Operational" : "No Telemetry Signal",
      value: connected ? "ONLINE" : "OFFLINE",
    });

    return events;
  }, [missionStartTime, current, alerts, connected]);

  // Export native Excel Workbook (.xlsx)
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // 1. Mission Summary Sheet
    const summaryData = [
      { Parameter: "Mission Start Time", Value: new Date(missionStartTime).toLocaleString() },
      { Parameter: "Flight Duration", Value: stats.durationStr },
      { Parameter: "Max Altitude (m)", Value: stats.maxAlt.toFixed(2) },
      { Parameter: "Top Airspeed (m/s)", Value: stats.maxSpeed.toFixed(2) },
      { Parameter: "Peak Motor Power (W)", Value: stats.peakPower.toFixed(2) },
      { Parameter: "Total Telemetry Data Points", Value: stats.dataPoints },
      { Parameter: "Active Connection Status", Value: connected ? "CONNECTED" : "DISCONNECTED" },
    ];
    const summarySheet = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, "Mission Summary");

    // 2. System & Warning Logs Sheet
    const logSheetData = logEvents.map((evt) => ({
      "Timestamp (Local)": evt.timestamp,
      "Log Level": evt.level,
      "Subsystem": evt.subsystem,
      "Event Message": evt.message,
      "Triggered Value / Detail": evt.value,
    }));
    const logsSheet = XLSX.utils.json_to_sheet(logSheetData);
    XLSX.utils.book_append_sheet(wb, logsSheet, "System & Warning Logs");

    // 3. Telemetry Time-Series Sheet
    const len = history.altitude.length;
    const telemetrySheetData = [];

    for (let i = 0; i < len; i++) {
      telemetrySheetData.push({
        "Relative Time (s)": history.altitude[i]?.time?.toFixed(1) ?? i,
        "Altitude (m)": history.altitude[i]?.value ?? 0,
        "Airspeed (m/s)": history.speed[i]?.value ?? 0,
        "Roll (deg)": current.flight.roll,
        "Pitch (deg)": current.flight.pitch,
        "Yaw (deg)": current.flight.yaw,
        "GPS Latitude": current.gps.latitude,
        "GPS Longitude": current.gps.longitude,
        "GPS Satellites": current.gps.satellites,
        "Battery Voltage (V)": history.batteryVoltage[i]?.value ?? 0,
        "Battery Current (A)": history.batteryCurrent[i]?.value ?? 0,
        "Battery Level (%)": current.battery.percentage,
        "Battery Temp (C)": current.battery.temperature,
        "Fuel Cell Voltage (V)": history.fuelCellVoltage[i]?.value ?? 0,
        "Fuel Cell Current (A)": history.fuelCellCurrent[i]?.value ?? 0,
        "Fuel Cell Temp (C)": current.fuelCell.temperature,
        "Fuel Cell Tank (%)": current.fuelCell.tankPercentage,
        "Fuel Cell Pressure (bar)": current.fuelCell.pressure,
        "DC Bus Voltage (V)": history.dcBusVoltage[i]?.value ?? 0,
        "DC Bus Current (A)": history.dcBusCurrent[i]?.value ?? 0,
        "Motor Power (W)": history.motorPower[i]?.value ?? 0,
        "RSSI (dBm)": history.rssi[i]?.value ?? 0,
      });
    }

    const telemetrySheet = XLSX.utils.json_to_sheet(telemetrySheetData.length > 0 ? telemetrySheetData : [
      {
        "Relative Time (s)": 0,
        "Altitude (m)": current.flight.altitude,
        "Airspeed (m/s)": current.flight.speed,
        "Roll (deg)": current.flight.roll,
        "Pitch (deg)": current.flight.pitch,
        "Yaw (deg)": current.flight.yaw,
        "GPS Latitude": current.gps.latitude,
        "GPS Longitude": current.gps.longitude,
        "GPS Satellites": current.gps.satellites,
        "Battery Voltage (V)": current.battery.voltage,
        "Battery Current (A)": current.battery.current,
        "Battery Level (%)": current.battery.percentage,
        "Battery Temp (C)": current.battery.temperature,
        "Fuel Cell Voltage (V)": current.fuelCell.voltage,
        "Fuel Cell Current (A)": current.fuelCell.current,
        "Fuel Cell Temp (C)": current.fuelCell.temperature,
        "Fuel Cell Tank (%)": current.fuelCell.tankPercentage,
        "Fuel Cell Pressure (bar)": current.fuelCell.pressure,
        "DC Bus Voltage (V)": current.dcBus.voltage,
        "DC Bus Current (A)": current.dcBus.current,
        "Motor Power (W)": current.motor?.power ?? 0,
        "RSSI (dBm)": current.signal.rssi,
      }
    ]);
    XLSX.utils.book_append_sheet(wb, telemetrySheet, "Telemetry Data");

    // Write file
    XLSX.writeFile(wb, `AeroTwin_Flight_Log_${Date.now()}.xlsx`);

    setDownloadMsg("Excel flight workbook (.xlsx) exported successfully!");
  };

  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Time(s),Altitude(m),Speed(m/s),Roll(deg),Pitch(deg),Yaw(deg),Latitude,Longitude,Satellites,BatVoltage(V),BatCurrent(A),BatLevel(%),BatTemp(C),FCVoltage(V),FCCurrent(A),FCTemp(C),FCTank(%),FCPressure(bar),DCBusVoltage(V),DCBusCurrent(A),MotorPower(W),RSSI(dBm)\n";
    const len = history.altitude.length;

    for (let i = 0; i < len; i++) {
      const time = history.altitude[i]?.time ?? i;
      const alt = history.altitude[i]?.value ?? 0;
      const spd = history.speed[i]?.value ?? 0;
      const bv = history.batteryVoltage[i]?.value ?? 0;
      const bi = history.batteryCurrent[i]?.value ?? 0;
      const fcv = history.fuelCellVoltage[i]?.value ?? 0;
      const fci = history.fuelCellCurrent[i]?.value ?? 0;
      const dcv = history.dcBusVoltage[i]?.value ?? 0;
      const dci = history.dcBusCurrent[i]?.value ?? 0;
      const pwr = history.motorPower[i]?.value ?? 0;
      const rssi = history.rssi[i]?.value ?? 0;

      csvContent += `${time.toFixed(1)},${alt.toFixed(2)},${spd.toFixed(2)},${current.flight.roll.toFixed(1)},${current.flight.pitch.toFixed(1)},${current.flight.yaw.toFixed(1)},${current.gps.latitude.toFixed(6)},${current.gps.longitude.toFixed(6)},${current.gps.satellites},${bv.toFixed(2)},${bi.toFixed(2)},${current.battery.percentage.toFixed(1)},${current.battery.temperature.toFixed(1)},${fcv.toFixed(2)},${fci.toFixed(2)},${current.fuelCell.temperature.toFixed(1)},${current.fuelCell.tankPercentage.toFixed(1)},${current.fuelCell.pressure.toFixed(1)},${dcv.toFixed(2)},${dci.toFixed(2)},${pwr.toFixed(1)},${rssi}\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `aerotwin_telemetry_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();

    setDownloadMsg("CSV log downloaded!");
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
      missionStart: new Date(missionStartTime).toISOString(),
      summaryStats: stats,
      systemLogs: logEvents,
      currentTelemetry: current,
      historySeries: history,
    }, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `aerotwin_flight_log_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();

    setDownloadMsg("JSON log downloaded!");
  };

  return (
    <div className={styles.container}>
      {/* ── Header ────────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleGroup}>
          <Clock3 size={22} color="var(--accent-cyan)" />
          <div>
            <h1 className="text-page-title">FLIGHT LOG & REPLAY</h1>
            <span className={styles.subtitle}>Session stats, flight telemetry, and warning log exports</span>
          </div>
        </div>

        <div className={styles.actions}>
          <button className={styles.btn} onClick={handleExportExcel} title="Export Full Excel Workbook (.xlsx)">
            <FileSpreadsheet size={15} /> EXCEL (.XLSX) LOG
          </button>
          <button className={styles.btn} onClick={handleExportCSV} title="Export CSV Telemetry Data">
            <Download size={14} /> CSV EXPORT
          </button>
          <button className={styles.btn} onClick={handleExportJSON} title="Export JSON Log">
            <Download size={14} /> JSON LOG
          </button>
          <button className={styles.btn} onClick={resetMission} title="Reset Mission Timer">
            <RefreshCw size={14} /> RESET TIMER
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

      {/* ── Stats Summary Grid ───────────────────────────── */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>FLIGHT DURATION</span>
          <span className={styles.statValue}>{stats.durationStr}</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>MAX ALTITUDE</span>
          <span className={styles.statValue}>{stats.maxAlt.toFixed(1)} m</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>TOP AIRSPEED</span>
          <span className={styles.statValue}>{stats.maxSpeed.toFixed(1)} m/s</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>PEAK POWER</span>
          <span className={styles.statValue}>{stats.peakPower.toFixed(0)} W</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statLabel}>LOGGED POINTS</span>
          <span className={styles.statValue}>{stats.dataPoints}</span>
        </div>
      </div>

      {/* ── Main Section: Event & Warning Logs ───────────── */}
      <div className={styles.mainGrid}>
        {/* Flight Event History Table */}
        <div className={styles.panel}>
          <div className={styles.panelTitle}>FLIGHT EVENT & WARNING LOGS</div>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIME</th>
                <th>SUBSYSTEM</th>
                <th>EVENT / WARNING MESSAGE</th>
                <th>LEVEL</th>
              </tr>
            </thead>
            <tbody>
              {logEvents.map((evt, idx) => (
                <tr key={idx}>
                  <td>{evt.timestamp}</td>
                  <td style={{ fontWeight: 600 }}>{evt.subsystem}</td>
                  <td>{evt.message}</td>
                  <td>
                    <span className={`${styles.tag} ${evt.level === "CRITICAL" ? styles.tagWarn : evt.level === "WARN" ? styles.tagWarn : styles.tagInfo}`}>
                      {evt.level}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

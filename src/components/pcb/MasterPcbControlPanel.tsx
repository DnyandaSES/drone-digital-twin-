/* ────────────────────────────────────────────────────────
   AEROTWIN — MASTER PCB & REMOTE THROTTLE CONTROL PANEL
   Interactive ground control interface matching ESP32 firmware:
   - Remote Throttle over UDP 8889: [1, throttle%]
   - Emergency Stop over UDP 8889: [2, 4]
   - Solenoid valve monitoring & actuation
   - MCP4261 digital potentiometers R1 & R2
   - Triple ACS37800 current/voltage sensor monitors
   ──────────────────────────────────────────────────────── */

import { useState, useEffect, useRef, memo } from "react";
import {
  Cpu,
  Flame,
  Sliders,
  Play,
  Square,
  ShieldAlert,
  Layers,
} from "lucide-react";

import { useTelemetryStore } from "../../store/telemetryStore";
import { SmoothNumber } from "../../hooks/useSmoothNumber";
import {
  sendThrottleCommand,
  sendEmergencyStopCommand,
  sendEsp32Command,
} from "../../lib/tauriCommands";

import styles from "./MasterPcbControlPanel.module.css";

function MasterPcbControlPanel() {
  const current = useTelemetryStore((s) => s.current);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");
  const pcb = current.masterPcb;

  // Local state for interactive throttle slider
  const liveThrottle = pcb?.throttle ?? 0;
  const [sliderVal, setSliderVal] = useState<number>(liveThrottle);
  const [lastAction, setLastAction] = useState<string>("Ready");
  const isDraggingRef = useRef(false);
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync local slider with incoming live telemetry when user is not actively adjusting it
  useEffect(() => {
    if (!isDraggingRef.current) {
      setSliderVal(liveThrottle);
    }
  }, [liveThrottle]);

  const transmitThrottle = async (val: number) => {
    setLastAction(`Setting Throttle: ${val}%`);
    const res = await sendThrottleCommand(val);
    if (!res.success) {
      setLastAction(`Error: ${res.message}`);
    } else {
      setLastAction(`Throttle set to ${val}%`);
    }
  };

  const handleSliderInput = (val: number) => {
    setSliderVal(val);
    isDraggingRef.current = true;

    // Throttle network UDP packets while sliding
    if (!throttleTimeoutRef.current) {
      throttleTimeoutRef.current = setTimeout(() => {
        throttleTimeoutRef.current = null;
        transmitThrottle(val);
      }, 80);
    }
  };

  const handleSliderCommit = (val: number) => {
    if (throttleTimeoutRef.current) {
      clearTimeout(throttleTimeoutRef.current);
      throttleTimeoutRef.current = null;
    }
    setSliderVal(val);
    transmitThrottle(val);
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 400);
  };

  const handleArm = async () => {
    setLastAction("Arming ESC (START)...");
    await sendEsp32Command("START");
    await sendThrottleCommand(0);
    setSliderVal(0);
    setLastAction("ESC Armed (0% Throttle)");
  };

  const handleDisarm = async () => {
    setLastAction("Disarming ESC (STOP)...");
    await sendEsp32Command("STOP");
    setSliderVal(0);
    setLastAction("ESC Disarmed");
  };

  const handleEmergencyStop = async () => {
    setLastAction("EMERGENCY STOP TRIGGERED!");
    await sendEmergencyStopCommand();
    setSliderVal(0);
    setLastAction("EMERGENCY STOP EXECUTED");
  };

  const handleValveToggle = async (mode: "ON" | "OFF" | "AUTO") => {
    setLastAction(`Command: VALVE ${mode}`);
    await sendEsp32Command(`VALVE ${mode}`);
  };

  const valveOpen = pcb?.valveOpen ?? false;
  const r1 = pcb?.r1Resistance ?? 62.0;
  const r2 = pcb?.r2Resistance ?? 60.0;

  return (
    <div className={styles.panel}>
      {/* ── Header ────────────────────────────────────── */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.iconWrap}>
            <Cpu size={18} strokeWidth={2} />
          </div>
          <div>
            <div className={styles.title}>Master PCB Link & Control</div>
            <div className={styles.subtitle}>ESP32-S3 Hardware Controller · UDP :8888 ⇄ :8889</div>
          </div>
        </div>

        <div className={styles.badgeGroup}>
          <span
            className={`${styles.statusPill} ${
              connected ? styles.pillConnected : styles.pillDisconnected
            }`}
          >
            <span className={styles.pulseDot} />
            {connected ? "LINK ACTIVE" : "DISCONNECTED"}
          </span>
        </div>
      </div>

      {/* ── ESC Throttle Controller ──────────────────── */}
      <div className={styles.throttleSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionLabel}>
            <Sliders size={13} />
            Propulsion ESC Remote Throttle
          </div>
          <div className={styles.throttleDisplay}>
            <span className={styles.throttleNumber}>{sliderVal}</span>
            <span className={styles.throttleUnit}>%</span>
          </div>
        </div>

        {/* Range Slider */}
        <div className={styles.sliderWrap}>
          <input
            type="range"
            min={0}
            max={100}
            value={sliderVal}
            onPointerDown={() => {
              isDraggingRef.current = true;
            }}
            onPointerUp={(e) => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
            onTouchEnd={(e) => handleSliderCommit(Number((e.target as HTMLInputElement).value))}
            onChange={(e) => handleSliderInput(Number(e.target.value))}
            className={styles.slider}
            style={{
              background: `linear-gradient(to right, var(--accent-cyan) 0%, var(--accent-cyan) ${sliderVal}%, var(--line-rivet) ${sliderVal}%, var(--line-rivet) 100%)`,
            }}
          />
        </div>

        {/* Preset Buttons */}
        <div className={styles.presetBar}>
          {[0, 20, 40, 60, 80, 100].map((val) => (
            <button
              key={val}
              className={styles.presetBtn}
              onClick={() => handleSliderCommit(val)}
            >
              {val}%
            </button>
          ))}
        </div>

        {/* Action Controls */}
        <div className={styles.btnGroup}>
          <button className={styles.armBtn} onClick={handleArm} title="Arm ESC & Start PWM (wait 3s)">
            <Play size={13} fill="currentColor" />
            ARM ESC
          </button>
          <button className={styles.disarmBtn} onClick={handleDisarm} title="Stop PWM">
            <Square size={13} fill="currentColor" />
            DISARM
          </button>
          <button
            className={styles.eStopBtn}
            onClick={handleEmergencyStop}
            title="Instant PWM Cutoff via UDP [2,4]"
          >
            <ShieldAlert size={15} />
            E-STOP
          </button>
        </div>
      </div>

      {/* ── Hardware Subsystems: Valve & Digipots ─────── */}
      <div className={styles.hardwareGrid}>
        {/* Solenoid Valve Card */}
        <div className={styles.hwCard}>
          <div className={styles.hwHeader}>
            <span className={styles.hwTitle}>
              <Flame size={12} color="#F59E0B" />
              H₂ Solenoid Valve (PIN 8)
            </span>
            <span
              className={`${styles.valveState} ${
                valveOpen ? styles.valveOpen : styles.valveClosed
              }`}
            >
              {valveOpen ? "OPEN" : "CLOSED"}
            </span>
          </div>

          <div className={styles.valveActions}>
            <button className={styles.miniBtn} onClick={() => handleValveToggle("ON")}>
              OPEN
            </button>
            <button className={styles.miniBtn} onClick={() => handleValveToggle("OFF")}>
              CLOSE
            </button>
            <button className={styles.miniBtn} onClick={() => handleValveToggle("AUTO")}>
              AUTO
            </button>
          </div>
        </div>

        {/* MCP4261 Digital Potentiometers */}
        <div className={styles.hwCard}>
          <div className={styles.hwHeader}>
            <span className={styles.hwTitle}>
              <Layers size={12} color="#4FD8E0" />
              MCP4261 SPI Digipot (CS 16/18)
            </span>
          </div>
          <div className={styles.resValues}>
            <div className={styles.resItem}>
              <span className={styles.resLabel}>IC1 (R1)</span>
              <span className={styles.resVal}>{r1.toFixed(1)} Ω</span>
            </div>
            <div className={styles.resItem}>
              <span className={styles.resLabel}>IC2 (R2)</span>
              <span className={styles.resVal}>{r2.toFixed(1)} Ω</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Triple ACS37800 Hardware Sensor Strip ───────── */}
      <div className={styles.acsGrid}>
        {/* Battery Sensor 0x60 */}
        <div className={styles.acsCard}>
          <div className={styles.acsTitle}>Battery ACS37800</div>
          <div className={styles.acsSub}>I2C ADDR: 0x60</div>
          <div className={styles.acsMetrics}>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Voltage:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.battery.voltage} decimals={2} unit="V" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Current:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.battery.current} decimals={2} unit="A" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Power:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber
                  value={pcb?.batteryPower ?? current.battery.voltage * current.battery.current}
                  decimals={1}
                  unit="W"
                />
              </span>
            </div>
          </div>
        </div>

        {/* Fuel Cell Sensor 0x63 */}
        <div className={styles.acsCard}>
          <div className={styles.acsTitle}>Fuel Cell ACS37800</div>
          <div className={styles.acsSub}>I2C ADDR: 0x63</div>
          <div className={styles.acsMetrics}>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Voltage:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.fuelCell.voltage} decimals={2} unit="V" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Current:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.fuelCell.current} decimals={2} unit="A" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Pressure:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.fuelCell.pressure} decimals={1} unit="bar" />
              </span>
            </div>
          </div>
        </div>

        {/* Common DC Bus Sensor 0x6C */}
        <div className={styles.acsCard}>
          <div className={styles.acsTitle}>Common Bus ACS37800</div>
          <div className={styles.acsSub}>I2C ADDR: 0x6C</div>
          <div className={styles.acsMetrics}>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Voltage:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.dcBus.voltage} decimals={2} unit="V" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Current:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber value={current.dcBus.current} decimals={2} unit="A" />
              </span>
            </div>
            <div className={styles.acsMetricRow}>
              <span className={styles.acsMetricKey}>Power:</span>
              <span className={styles.acsMetricVal}>
                <SmoothNumber
                  value={pcb?.commonBusPower ?? current.dcBus.voltage * current.dcBus.current}
                  decimals={1}
                  unit="W"
                />
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer Link Status ───────────────────────── */}
      <div className={styles.footerInfo}>
        <span>STATUS: {lastAction}</span>
        <span>PORTS: RX: 8888 · TX: 8889</span>
      </div>
    </div>
  );
}

export default memo(MasterPcbControlPanel);

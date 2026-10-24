/**
 * AeroTwin — Master PCB ESP32 Telemetry & Throttle Simulator
 *
 * Replicates the exact firmware behavior of the Master PCB:
 * 1. Broadcasts JSON telemetry packets on UDP port 8888 at 5 Hz (200ms)
 *    Keys: {"vB", "iB", "pB", "vF", "iF", "pF", "vC", "iC", "pC", "thr",
 *           "rssi", "battPct", "tankPct", "pres", "tempB", "tempF", "vlv", "r1", "r2"}
 * 2. Listens on UDP port 8889 for remote throttle & commands:
 *    - Binary [1, throttle%]: Sets ESC throttle
 *    - Binary [2, 4]: Emergency stop
 *    - Text "START", "STOP", "VALVE ON", "VALVE OFF"
 *
 * Usage:
 *   node simulate_telemetry.js [telePort] [throttlePort]
 */

const dgram = require("dgram");

const TELE_PORT = parseInt(process.argv[2], 10) || 8888;
const THROTTLE_PORT = parseInt(process.argv[3], 10) || 8889;
const HOST = "127.0.0.1";

// UDP sender for telemetry
const teleSocket = dgram.createSocket("udp4");

// UDP receiver for throttle
const throttleSocket = dgram.createSocket("udp4");

// Simulated state variables matching ESP32 firmware
let pwmEnabled = true;
let throttlePercent = 45;
let valveOpen = true;
let wiperIC1 = 1;
let wiperIC2 = 2;
let step = 0;

// Resistance calibration lookup (matching ESP32 arrays)
const IC1_Res = [62.0, 79.0, 81.0, 95.0, 105.0, 113.0, 116.0];
const IC2_Res = [60.0, 70.0, 79.0, 88.0, 96.0, 105.0, 113.0];

function getR1() {
  return IC1_Res[wiperIC1] || 79.0;
}

function getR2() {
  return IC2_Res[wiperIC2] || 88.0;
}

console.log("═══════════════════════════════════════════════════════════════");
console.log("🚁 AEROTWIN — ESP32 MASTER PCB SIMULATOR");
console.log(`📡 Broadcasting telemetry on ${HOST}:${TELE_PORT} (5 Hz / 200ms)`);
console.log(`🎮 Listening for throttle commands on ${HOST}:${THROTTLE_PORT}`);
console.log("═══════════════════════════════════════════════════════════════");

// Generate realistic electrical & sensor parameters matching ESP32
function generateMasterPcbPayload() {
  step++;
  const t = step * 0.2;

  // Base motor draw depends on throttle percentage
  const motorFactor = pwmEnabled ? (throttlePercent / 100) : 0;
  const motorCurrent = motorFactor * 32.0 + Math.sin(t * 1.5) * 0.8;

  // Common bus: 51-52V
  const vBus = 51.6 + Math.sin(t * 0.4) * 0.3;
  const iBus = Math.max(0, motorCurrent);
  const pBus = vBus * iBus;

  // Battery: 6S LiPo ~24-25V
  const vBatt = Math.max(20.5, 25.2 - (step * 0.002));
  const iBatt = Math.max(0, (motorCurrent * 0.45));
  const pBatt = vBatt * iBatt;
  const battPct = Math.max(10, Math.round(((vBatt - 20.0) / (29.4 - 20.0)) * 100));

  // Fuel Cell: ~15V
  const vFC = 15.1 + Math.sin(t * 0.3) * 0.2;
  const iFC = Math.max(0, (motorCurrent * 0.55));
  const pFC = vFC * iFC;
  const fcTankPct = Math.max(15, 92.5 - (step * 0.001));
  const fcPressure = (fcTankPct / 100.0) * 300.0;

  // Temperatures
  const tempBatt = 30.0 + Math.abs(iBatt) * 0.25;
  const tempFC = 35.0 + Math.abs(iFC) * 0.35;

  const rssi = -52 + Math.floor(Math.sin(t * 0.1) * 6);

  // Exact snprintf format matching ESP32 firmware
  const payloadObj = {
    vB: parseFloat(vBatt.toFixed(2)),
    iB: parseFloat(iBatt.toFixed(2)),
    pB: parseFloat(pBatt.toFixed(1)),
    vF: parseFloat(vFC.toFixed(2)),
    iF: parseFloat(iFC.toFixed(2)),
    pF: parseFloat(pFC.toFixed(1)),
    vC: parseFloat(vBus.toFixed(2)),
    iC: parseFloat(iBus.toFixed(2)),
    pC: parseFloat(pBus.toFixed(1)),
    thr: pwmEnabled ? throttlePercent : 0,
    rssi: rssi,
    battPct: battPct,
    tankPct: parseFloat(fcTankPct.toFixed(1)),
    pres: parseFloat(fcPressure.toFixed(1)),
    tempB: parseFloat(tempBatt.toFixed(1)),
    tempF: parseFloat(tempFC.toFixed(1)),
    vlv: valveOpen ? 1 : 0,
    r1: parseFloat(getR1().toFixed(1)),
    r2: parseFloat(getR2().toFixed(1)),
  };

  return JSON.stringify(payloadObj);
}

// 5 Hz Telemetry Broadcast Loop (every 200 ms)
const teleInterval = setInterval(() => {
  const jsonStr = generateMasterPcbPayload();
  const buffer = Buffer.from(jsonStr);

  teleSocket.send(buffer, TELE_PORT, HOST, (err) => {
    if (err) {
      console.error("Telemetry send error:", err);
    }
  });
}, 200);

// Setup UDP receiver for remote throttle
throttleSocket.on("message", (msg, rinfo) => {
  if (msg.length === 2) {
    if (msg[0] === 1) {
      if (msg[1] === 0) {
        pwmEnabled = false;
        throttlePercent = 0;
        console.log(`[UDP 8889] Stop PWM (Throttle 0%) from ${rinfo.address}`);
      } else {
        pwmEnabled = true;
        throttlePercent = msg[1];
        console.log(`[UDP 8889] Remote Throttle set: ${throttlePercent}% from ${rinfo.address}`);
      }
    } else if (msg[0] === 2 && msg[1] === 4) {
      pwmEnabled = false;
      throttlePercent = 0;
      console.log(`[UDP 8889] 🚨 EMERGENCY STOP RECEIVED from ${rinfo.address}!`);
    }
  } else if (msg.length > 0) {
    const text = msg.toString("utf8").trim().toUpperCase();
    console.log(`[UDP 8889] Command received: "${text}" from ${rinfo.address}`);
    if (text === "START") {
      pwmEnabled = true;
      console.log("[ESP32 SIM] ESC ARMED / PWM STARTED");
    } else if (text === "STOP") {
      pwmEnabled = false;
      throttlePercent = 0;
      console.log("[ESP32 SIM] ESC STOPPED");
    } else if (text === "VALVE ON") {
      valveOpen = true;
      console.log("[ESP32 SIM] VALVE OPENED");
    } else if (text === "VALVE OFF") {
      valveOpen = false;
      console.log("[ESP32 SIM] VALVE CLOSED");
    } else if (/^\d+$/.test(text)) {
      pwmEnabled = true;
      throttlePercent = Math.min(100, parseInt(text, 10));
      console.log(`[ESP32 SIM] Text throttle set: ${throttlePercent}%`);
    }
  }
});

throttleSocket.bind(THROTTLE_PORT, () => {
  console.log(`✅ Throttle listener bound on UDP port ${THROTTLE_PORT}`);
});

process.on("SIGINT", () => {
  clearInterval(teleInterval);
  teleSocket.close();
  throttleSocket.close(() => {
    console.log("\nSimulator stopped.");
    process.exit(0);
  });
});

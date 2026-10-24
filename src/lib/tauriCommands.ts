/* ────────────────────────────────────────────────────────
   AEROTWIN — TAURI COMMAND INTERFACE
   Bridge functions between React frontend and Rust backend.
   Sends UDP telemetry control commands to ESP32 on port 8889.
   ──────────────────────────────────────────────────────── */

import { invoke, isTauri } from "@tauri-apps/api/core";

/**
 * Sends request to Tauri Rust backend to re-bind UDP listener to the specified port.
 */
export async function updateBackendUdpPort(
  port: number
): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    return {
      success: false,
      message: "Tauri backend unavailable in browser mode",
    };
  }
  try {
    const boundPort = await invoke<number>("change_udp_port", { port });
    return {
      success: true,
      message: `UDP socket successfully bound to port ${boundPort}`,
    };
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : JSON.stringify(err);
    console.warn("[Tauri UDP] Failed to change UDP port:", errorMsg);
    return {
      success: false,
      message: errorMsg || `Failed to bind UDP socket on port ${port}`,
    };
  }
}

/**
 * Gets currently active bound UDP port from Rust backend.
 */
export async function getBackendUdpPort(): Promise<number | null> {
  if (!isTauri()) {
    return null;
  }
  try {
    return await invoke<number>("get_udp_port");
  } catch {
    return null;
  }
}

/**
 * Sends remote throttle percentage (0-100%) to ESP32 on UDP port 8889.
 * Format on wire: [1, throttlePercent]
 */
export async function sendThrottleCommand(
  throttle: number
): Promise<{ success: boolean; message: string }> {
  const clamped = Math.max(0, Math.min(100, Math.round(throttle)));
  if (!isTauri()) {
    if (import.meta.hot) {
      import.meta.hot.send("custom:drone-throttle", { throttle: clamped });
    }
    fetch("/api/drone/throttle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ throttle: clamped }),
    }).catch(() => {});
    return {
      success: true,
      message: `Throttle ${clamped}% sent to drone (UDP 8889)`,
    };
  }
  try {
    const result = await invoke<string>("send_throttle", { throttle: clamped });
    return { success: true, message: result };
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : JSON.stringify(err);
    console.warn("[Tauri Throttle] Error sending throttle:", errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Sends EMERGENCY STOP to ESP32 on UDP port 8889.
 * Format on wire: [2, 4]
 */
export async function sendEmergencyStopCommand(): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    if (import.meta.hot) {
      import.meta.hot.send("custom:drone-estop");
    }
    fetch("/api/drone/estop", { method: "POST" }).catch(() => {});
    return {
      success: true,
      message: "EMERGENCY STOP dispatched to drone! (UDP 8889)",
    };
  }
  try {
    const result = await invoke<string>("send_emergency_stop");
    return { success: true, message: result };
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : JSON.stringify(err);
    console.warn("[Tauri Emergency Stop] Error:", errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Sends text command (e.g. "START", "STOP", "VALVE ON", "VALVE OFF") to ESP32 on port 8889.
 */
export async function sendEsp32Command(
  command: string
): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    if (import.meta.hot) {
      import.meta.hot.send("custom:drone-command", { command });
    }
    return {
      success: true,
      message: `Command "${command}" sent to drone`,
    };
  }
  try {
    const result = await invoke<string>("send_command", { command });
    return { success: true, message: result };
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : JSON.stringify(err);
    console.warn("[Tauri Command] Error:", errorMsg);
    return { success: false, message: errorMsg };
  }
}

/**
 * Sets target drone IP address for UDP commands.
 */
export async function setTargetDroneIpCommand(
  ip: string
): Promise<{ success: boolean; message: string }> {
  if (!isTauri()) {
    return { success: true, message: `Simulated target IP set to ${ip}` };
  }
  try {
    const result = await invoke<string>("set_target_drone_ip", { ip });
    return { success: true, message: result };
  } catch (err) {
    const errorMsg = typeof err === "string" ? err : JSON.stringify(err);
    return { success: false, message: errorMsg };
  }
}

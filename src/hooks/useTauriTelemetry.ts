/* ────────────────────────────────────────────────────────
   AEROTWIN — useTauriTelemetry
   Listens to live ESP32 UDP telemetry packets from
   the Vite UDP bridge (web) or Tauri backend (desktop).
   Includes high-performance throttling to maintain 60 FPS
   and prevent main thread saturation.
   ──────────────────────────────────────────────────────── */

import { useEffect } from "react";
import { listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";

import { useTelemetryStore } from "../store/telemetryStore";
import { useSettingsStore } from "../store/settingsStore";
import { updateBackendUdpPort } from "../lib/tauriCommands";
import { normalizeTelemetry } from "../lib/telemetryParser";


/**
 * Mount this hook ONCE at the top level (App.tsx).
 * Syncs saved UDP port with backend and listens to telemetry packets.
 */
export function useTauriTelemetry(): void {
  useEffect(() => {
    const store = useTelemetryStore.getState();
    store.resetMission();
    store.setConnectionStatus("disconnected");

    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
    let throttleTimer: ReturnType<typeof setTimeout> | null = null;
    let latestSnapshot: ReturnType<typeof normalizeTelemetry> | null = null;
    let isDisposed = false;

    const commitTelemetry = () => {
      throttleTimer = null;
      if (isDisposed || !latestSnapshot) return;
      if (useTelemetryStore.getState().connectionStatus !== "connected") {
        useTelemetryStore.getState().setConnectionStatus("connected");
      }
      useTelemetryStore.getState().updateTelemetry(latestSnapshot);
    };

    const handlePacket = (rawString: string) => {
      if (isDisposed) return;
      try {
        const rawJson = typeof rawString === "string" ? JSON.parse(rawString) : rawString;
        latestSnapshot = normalizeTelemetry(rawJson);

        // Throttle React state updates to 4 Hz (250ms) to guarantee silky-smooth UI rendering
        if (!throttleTimer) {
          throttleTimer = setTimeout(commitTelemetry, 250);
        }

        const timeoutMs = useSettingsStore.getState().watchdogTimeoutMs || 3500;
        if (watchdogTimer) clearTimeout(watchdogTimer);
        watchdogTimer = setTimeout(() => {
          if (throttleTimer) {
            clearTimeout(throttleTimer);
            throttleTimer = null;
          }
          if (!isDisposed) {
            useTelemetryStore.getState().setConnectionStatus("disconnected");
          }
        }, timeoutMs);
      } catch (err) {
        console.warn("[UDP Telemetry] Packet parse error:", err);
      }
    };

    if (!isTauri()) {
      console.info("⚡ [AeroTwin] Connecting to UDP telemetry stream (/api/telemetry-stream)...");

      let eventSource: EventSource | null = null;
      try {
        eventSource = new EventSource("/api/telemetry-stream");
        eventSource.onmessage = (event) => {
          handlePacket(event.data);
        };
        eventSource.onerror = () => {
          // SSE will automatically retry in browser
        };
      } catch (e) {
        console.warn("[AeroTwin SSE] EventSource init error:", e);
      }

      return () => {
        isDisposed = true;
        if (watchdogTimer) clearTimeout(watchdogTimer);
        if (throttleTimer) clearTimeout(throttleTimer);
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    }

    const savedPort = useSettingsStore.getState().udpPort;
    if (savedPort && savedPort !== 8888) {
      updateBackendUdpPort(savedPort).catch(() => {});
    }

    // Listen strictly to live UDP telemetry packets from ESP32 via Tauri
    let unlistenFn: (() => void) | null = null;
    listen<string>("udp-message", (event) => {
      handlePacket(event.payload);
    }).then((unlisten) => {
      if (isDisposed) {
        unlisten();
      } else {
        unlistenFn = unlisten;
      }
    });

    return () => {
      isDisposed = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
      if (unlistenFn) unlistenFn();
    };
  }, []);
}

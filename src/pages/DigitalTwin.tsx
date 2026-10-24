/* ────────────────────────────────────────────────────────
   AEROTWIN — DIGITAL TWIN PAGE
   Full-page 3D visualization with live telemetry overlays,
   attitude ring, component status, and camera controls.
   ──────────────────────────────────────────────────────── */

import { useRef } from "react";

import TwinViewport, { type TwinViewportHandle } from "../components/twin/TwinViewport";
import TwinTelemetryOverlay from "../components/twin/TwinTelemetryOverlay";
import ViewControls from "../components/twin/ViewControls";
import ComponentStatus from "../components/twin/ComponentStatus";
import ComponentInfoCard from "../components/twin/ComponentInfoCard";
import AttitudeRing from "../components/flight/AttitudeRing";

import { useTelemetryStore } from "../store/telemetryStore";

import styles from "./DigitalTwin.module.css";


export default function DigitalTwin() {
  const viewportRef = useRef<TwinViewportHandle>(null);
  const connected = useTelemetryStore((s) => s.connectionStatus === "connected");

  return (
    <div className={styles.page}>

      {/* ── 3D Viewport (fills left area) ──────────────── */}
      <div className={styles.viewportArea}>
        <TwinViewport ref={viewportRef} />

        {/* HUD overlays (orientation + flight data + live badge) */}
        <TwinTelemetryOverlay />

        {/* Floating Component Info / Inspection Card */}
        <ComponentInfoCard />

        {/* Camera preset buttons */}
        <div className={styles.viewControlsWrap}>
          <ViewControls
            onPreset={(p) => viewportRef.current?.goToPreset(p)}
            onReset={() => viewportRef.current?.resetView()}
          />
        </div>

        {/* No-signal overlay */}
        {!connected && (
          <div className={styles.noSignalOverlay}>
            <span className={styles.noSignalText}>NO SIGNAL</span>
            <span className={styles.noSignalSub}>
              Waiting for telemetry on :8888
            </span>
          </div>
        )}
      </div>

      {/* ── Right Sidebar ──────────────────────────────── */}
      <div className={styles.sidebar}>
        {/* Attitude Ring */}
        <div className={styles.attitudeWrap}>
          <h3>Attitude</h3>
          <AttitudeRing />
        </div>

        {/* Component Status */}
        <ComponentStatus />
      </div>

    </div>
  );
}

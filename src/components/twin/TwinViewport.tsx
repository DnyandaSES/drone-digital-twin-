/* ────────────────────────────────────────────────────────
   AEROTWIN — TWIN VIEWPORT
   Main React Three Fiber canvas for the Digital Twin page.
   Contains the 3D drone model, radar grid, lighting,
   and orbit controls.  Follows app theme (dark / light).
   ──────────────────────────────────────────────────────── */

import { forwardRef, useImperativeHandle, useMemo, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import * as THREE from "three";

import { useTelemetryStore } from "../../store/telemetryStore";
import { useSettingsStore } from "../../store/settingsStore";
import { useTwinViewStore } from "../../store/twinViewStore";
import { useResolvedTheme, type ResolvedTheme } from "../../hooks/useResolvedTheme";
import DroneModel from "./DroneModel";
import RadarGrid from "./RadarGrid";


/* ── Theme palettes for the 3D scene ──────────────────── */

interface SceneTheme {
  bg: string;
  fog: string;
  ambientIntensity: number;
  mainLightColor: string;
  mainLightIntensity: number;
  fillLightColor: string;
  fillLightIntensity: number;
  gridRingColor: string;
  gridRingOpacity: number;
  gridAxisColor: string;
  gridAxisOpacity: number;
  gridCenterColor: string;
}

const SCENE_THEMES: Record<ResolvedTheme, SceneTheme> = {
  dark: {
    bg: "#060a0e",
    fog: "#060a0e",
    ambientIntensity: 0.35,
    mainLightColor: "#c8d8e8",
    mainLightIntensity: 0.9,
    fillLightColor: "#4FD8E0",
    fillLightIntensity: 0.3,
    gridRingColor: "#1a3040",
    gridRingOpacity: 0.5,
    gridAxisColor: "#1a4050",
    gridAxisOpacity: 0.7,
    gridCenterColor: "#4FD8E0",
  },
  light: {
    bg: "#e8e6e0",
    fog: "#e8e6e0",
    ambientIntensity: 0.65,
    mainLightColor: "#faf5eb",
    mainLightIntensity: 1.1,
    fillLightColor: "#0F8E96",
    fillLightIntensity: 0.25,
    gridRingColor: "#a0998a",
    gridRingOpacity: 0.35,
    gridAxisColor: "#7a7468",
    gridAxisOpacity: 0.5,
    gridCenterColor: "#0F8E96",
  },
};


/* ── Camera presets ────────────────────────────────────── */

export interface CameraPreset {
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_PRESETS: Record<string, CameraPreset> = {
  perspective: { position: [6, 4, 6],     target: [0, 0, 0] },
  top:         { position: [0, 10, 0.01],  target: [0, 0, 0] },
  bottom:      { position: [0, -10, 0.01], target: [0, 0, 0] },
  front:       { position: [0, 2, -8],    target: [0, 0, 0] },
  side:        { position: [8, 2, 0],     target: [0, 0, 0] },
  rear:        { position: [0, 3, 8],     target: [0, 0, 0] },
};


/* ── Viewport Handle (exposed to parent for camera control) */

export interface TwinViewportHandle {
  goToPreset: (preset: string) => void;
  resetView: () => void;
}


/* ── Background color sync helper ──────────────────────── */

function BackgroundSync({ color }: { color: string }) {
  const { scene, gl } = useThree();
  useMemo(() => {
    const c = new THREE.Color(color);
    scene.background = c;
    scene.fog = new THREE.Fog(color, 15, 30);
    gl.setClearColor(c);
  }, [color, scene, gl]);
  return null;
}


/* ── Inner Scene (rendered inside Canvas) ──────────────── */

interface InnerSceneProps {
  resolvedTheme: ResolvedTheme;
}

const InnerScene = forwardRef<TwinViewportHandle, InnerSceneProps>(
  function InnerScene({ resolvedTheme }, ref) {
    const controlsRef = useRef<OrbitControlsImpl>(null);

    const { roll, pitch, yaw } = useTelemetryStore((s) => s.current.flight);
    const connected = useTelemetryStore((s) => s.connectionStatus === "connected");
    const batteryPercent = useTelemetryStore((s) => s.current.battery.percentage);
    const h2TankPercent = useTelemetryStore((s) => s.current.fuelCell.tankPercentage);
    const throttle = useTelemetryStore((s) => s.current.masterPcb?.throttle ?? (s.current.motor?.power > 0 ? 40 : 0));

    const showRadarGrid = useSettingsStore((s) => s.showRadarGrid);
    const autoRotateDrone = useSettingsStore((s) => s.autoRotateDrone);
    const rotationSpeed = useSettingsStore((s) => s.rotationSpeed);
    const lightingIntensity = useSettingsStore((s) => s.lightingIntensity);

    // Twin view store
    const viewMode = useTwinViewStore((s) => s.viewMode);
    const shellOpacity = useTwinViewStore((s) => s.shellOpacity);
    const explodedFactor = useTwinViewStore((s) => s.explodedFactor);
    const showLabels = useTwinViewStore((s) => s.showLabels);
    const highlightedComponent = useTwinViewStore((s) => s.highlightedComponent);
    const faultOverrides = useTwinViewStore((s) => s.faultOverrides);

    const t = SCENE_THEMES[resolvedTheme];

    const animateTo = (preset: CameraPreset) => {
      const ctrl = controlsRef.current;
      if (!ctrl) return;

      const cam = ctrl.object as THREE.PerspectiveCamera;
      const startPos = cam.position.clone();
      const endPos = new THREE.Vector3(...preset.position);
      const startTarget = ctrl.target.clone();
      const endTarget = new THREE.Vector3(...preset.target);

      const duration = 600; // ms
      const startTime = performance.now();

      const animate = () => {
        const now = performance.now();
        const progress = Math.min((now - startTime) / duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3); // easeOutCubic

        cam.position.lerpVectors(startPos, endPos, ease);
        ctrl.target.lerpVectors(startTarget, endTarget, ease);
        ctrl.update();

        if (progress < 1) requestAnimationFrame(animate);
      };
      requestAnimationFrame(animate);
    };

    useImperativeHandle(ref, () => ({
      goToPreset: (preset: string) => {
        const p = CAMERA_PRESETS[preset];
        if (p) animateTo(p);
      },
      resetView: () => animateTo(CAMERA_PRESETS.perspective),
    }));

    return (
      <>
        {/* Dynamically sync background + fog */}
        <BackgroundSync color={t.bg} />

        {/* Lighting — enhanced for translucent materials */}
        <ambientLight intensity={t.ambientIntensity * lightingIntensity} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={t.mainLightIntensity * lightingIntensity}
          castShadow={false}
          color={t.mainLightColor}
        />
        <directionalLight
          position={[-3, 4, -5]}
          intensity={t.fillLightIntensity * lightingIntensity}
          color={t.fillLightColor}
        />
        {/* Bottom Fill Light for Underbelly Inspection */}
        <directionalLight
          position={[0, -8, 0]}
          intensity={t.fillLightIntensity * 1.2 * lightingIntensity}
          color={t.mainLightColor}
        />
        {/* Rear fill for tail section */}
        <directionalLight
          position={[0, 3, -8]}
          intensity={t.fillLightIntensity * 0.8 * lightingIntensity}
          color={t.fillLightColor}
        />
        {/* Side rim lights for wing definition */}
        <pointLight
          position={[6, 2, 0]}
          intensity={0.4 * lightingIntensity}
          color={t.fillLightColor}
          distance={15}
        />
        <pointLight
          position={[-6, 2, 0]}
          intensity={0.4 * lightingIntensity}
          color={t.fillLightColor}
          distance={15}
        />

        {/* Radar grid — themed */}
        {showRadarGrid && (
          <RadarGrid
            rings={8}
            spokes={12}
            radius={12}
            ringColor={t.gridRingColor}
            ringOpacity={t.gridRingOpacity}
            axisColor={t.gridAxisColor}
            axisOpacity={t.gridAxisOpacity}
            centerColor={t.gridCenterColor}
          />
        )}

        {/* Drone model — driven by telemetry + view mode */}
        <Suspense fallback={null}>
          <DroneModel
            roll={roll}
            pitch={pitch}
            yaw={yaw}
            connected={connected}
            throttle={throttle}
            theme={resolvedTheme}
            batteryPercent={batteryPercent}
            h2TankPercent={h2TankPercent}
            viewMode={viewMode}
            shellOpacity={shellOpacity}
            explodedFactor={explodedFactor}
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            faultOverrides={faultOverrides}
          />
        </Suspense>

        {/* Orbit controls — unlocked polar angle for bottom view */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          autoRotate={autoRotateDrone}
          autoRotateSpeed={rotationSpeed * 2.0}
          minDistance={3}
          maxDistance={25}
          maxPolarAngle={Math.PI * 0.98}
          minPolarAngle={0.02}
        />
      </>
    );
  },
);


/* ── Canvas Wrapper ────────────────────────────────────── */

const TwinViewport = forwardRef<TwinViewportHandle>(function TwinViewport(_props, ref) {
  const innerRef = useRef<TwinViewportHandle>(null);
  const resolvedTheme = useResolvedTheme();
  const cameraFov = useSettingsStore((s) => s.cameraFov);
  const t = SCENE_THEMES[resolvedTheme];

  useImperativeHandle(ref, () => ({
    goToPreset: (p: string) => innerRef.current?.goToPreset(p),
    resetView: () => innerRef.current?.resetView(),
  }));

  return (
    <Canvas
      camera={{
        position: [6, 4, 6],
        fov: cameraFov,
        near: 0.1,
        far: 100,
      }}
      style={{ width: "100%", height: "100%", background: t.bg }}
      gl={{ antialias: true, alpha: false }}
    >
      <InnerScene ref={innerRef} resolvedTheme={resolvedTheme} />
    </Canvas>
  );
});

export default TwinViewport;

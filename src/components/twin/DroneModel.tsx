
import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Html, useGLTF } from "@react-three/drei";
import { createPropellerGeometry, createRotorBlurDiscGeometry } from "./createPropellerGeometry";

import type { ResolvedTheme } from "../../hooks/useResolvedTheme";
import { useTwinViewStore, type ViewMode, type FaultLevel } from "../../store/twinViewStore";

const GAS_CYLINDER_PATH = "/models/gas_cylinder.glb";
useGLTF.preload(GAS_CYLINDER_PATH);

/* ── Types ─────────────────────────────────────────────── */

interface DroneModelProps {
  roll: number;
  pitch: number;
  yaw: number;
  connected: boolean;
  throttle?: number;
  theme: ResolvedTheme;
  batteryPercent: number;
  h2TankPercent: number;
  viewMode: ViewMode;
  shellOpacity: number;
  explodedFactor: number;
  showLabels: boolean;
  highlightedComponent: string | null;
  faultOverrides: Record<string, FaultLevel>;
}

/* ── Fault level → color ───────────────────────────────── */

function faultColor(level: FaultLevel): string {
  switch (level) {
    case "warning": return "#FBBF24";
    case "fault": return "#EF4444";
    case "disconnected": return "#6B7280";
    case "nodata": return "#9CA3AF";
    default: return "";
  }
}

function faultEmissive(level: FaultLevel, isHighlighted: boolean): string {
  if (isHighlighted) return "#4FD8E0";
  switch (level) {
    case "warning": return "#D97706";
    case "fault": return "#DC2626";
    default: return "#000000";
  }
}

function faultEmissiveIntensity(level: FaultLevel, isHighlighted: boolean): number {
  if (isHighlighted) return 0.9;
  switch (level) {
    case "warning": return 0.6;
    case "fault": return 1.2;
    default: return 0;
  }
}

/* ── Component visibility per view mode ────────────────── */

type ComponentGroup = "shell" | "h2system" | "electrical" | "frame" | "propulsion";

function groupOpacity(mode: ViewMode, group: ComponentGroup, shellOpacity: number): number {
  switch (mode) {
    case "external":
      return group === "shell" ? 1.0 : 0.0;
    case "translucent":
      return group === "shell" ? Math.min(shellOpacity, 0.28) : 1.0;
    case "internal":
      return group === "shell" ? 0.03 : 1.0;
    case "hydrogen":
      if (group === "h2system") return 1.0;
      if (group === "shell") return 0.10;
      return 0.15;
    case "electrical":
      if (group === "electrical" || group === "propulsion") return 1.0;
      if (group === "shell") return 0.10;
      return 0.15;
    case "fault":
      return group === "shell" ? 0.15 : 1.0;
    default:
      return 1.0;
  }
}

/* ── Exploded offsets for each component (Symmetrical & Clean) ── */

const EXPLODED_OFFSETS: Record<string, [number, number, number]> = {
  shell: [0, 3.5, 0],
  h2cylinder: [0, -1.2, -2.0],
  sensor1: [0, -0.8, -1.4],
  regulator: [0, -0.6, -0.8],
  h2piping: [0, -0.4, -0.2],
  fuelcell: [0, -1.2, 0.4],
  sensor2: [0, -0.6, 1.1],
  battery: [0, -1.2, 2.0],
  pcb: [0, -1.2, 2.8],
  wiring: [0, -0.3, 0.4],
  frame: [0, -2.5, 0],
  motor1: [-2.8, 2.0, -0.35],
  motor2: [-2.8, 2.0, 1.15],
  motor3: [2.8, 2.0, -0.35],
  motor4: [2.8, 2.0, 1.15],
  motor5: [0, 2.0, 4.0],
  esc1: [-2.0, 0.6, -0.35],
  esc2: [-2.0, 0.6, 1.15],
  esc3: [2.0, 0.6, -0.35],
  esc4: [2.0, 0.6, 1.15],
  esc5: [0, 0.6, 3.5],
};

/* ── Sleek Aerospace HUD Label (Unobtrusive & Offset) ──── */

function TwinLabel({ id, text, subtext, showLabels, highlightedComponent, position }: {
  id: string;
  text: string;
  subtext?: string;
  showLabels: boolean;
  highlightedComponent: string | null;
  position: [number, number, number];
}) {
  const isTarget = highlightedComponent === id;
  const isVisible = showLabels || isTarget;

  if (!isVisible) return null;

  return (
    <Html center position={position} zIndexRange={[20, 0]}>
      <div style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        pointerEvents: "none",
        userSelect: "none",
        transform: "translateY(-100%)",
        paddingBottom: "14px",
      }}>
        {/* Sleek Glass HUD Chip */}
        <div style={{
          fontFamily: "'Inter', 'SF Pro Display', system-ui, sans-serif",
          fontSize: "8.5px",
          fontWeight: 700,
          color: isTarget ? "#4FD8E0" : "#E2E8F0",
          background: isTarget ? "rgba(6, 20, 32, 0.92)" : "rgba(10, 16, 26, 0.78)",
          backdropFilter: "blur(6px)",
          WebkitBackdropFilter: "blur(6px)",
          padding: "2px 6px",
          borderRadius: "4px",
          border: isTarget ? "1px solid #4FD8E0" : "1px solid rgba(148, 163, 184, 0.25)",
          boxShadow: isTarget ? "0 0 10px rgba(79, 216, 224, 0.4)" : "0 2px 6px rgba(0,0,0,0.35)",
          whiteSpace: "nowrap",
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          lineHeight: 1.3,
          textAlign: "center",
          transition: "all 0.2s ease",
        }}>
          <div>{text}</div>
          {subtext && (
            <div style={{
              fontSize: "7.5px",
              fontWeight: 500,
              color: isTarget ? "#93E6EB" : "#94A3B8",
              letterSpacing: "0.04em",
              marginTop: "1px",
            }}>
              {subtext}
            </div>
          )}
        </div>

        {/* Delicate leader line & pinpoint beacon */}
        <div style={{
          width: "1px",
          height: "12px",
          background: isTarget ? "linear-gradient(to bottom, #4FD8E0, rgba(79,216,224,0.3))" : "linear-gradient(to bottom, rgba(148,163,184,0.6), rgba(148,163,184,0.1))",
        }} />
        <div style={{
          width: "4px",
          height: "4px",
          borderRadius: "50%",
          background: isTarget ? "#4FD8E0" : "#94A3B8",
          boxShadow: isTarget ? "0 0 6px #4FD8E0" : "none",
        }} />
      </div>
    </Html>
  );
}

/* ── Wing Shape Generator (matching outside.jpeg) ──────── */

function createWingShape(): THREE.Shape {
  const shape = new THREE.Shape();

  // Start at front pointed apex (compact length kept, pointed tip matching original profile)
  const noseY = -2.95;
  shape.moveTo(0, noseY);

  // Right side: Pointed nose tip → forward fuselage
  shape.bezierCurveTo(0.08, -2.72, 0.24, -2.40, 0.44, -2.10);

  // Smooth concave curved fillet connecting head to wing leading edge
  shape.bezierCurveTo(0.60, -1.90, 0.98, -1.86, 1.48, -1.82);

  // Wing leading edge sweeps gracefully towards forward rotor
  shape.bezierCurveTo(1.75, -1.76, 1.94, -1.64, 2.15, -1.56);

  // Outer wing flank: contoured tightly edge-to-edge around the forward rotor (center X=2.05, Y=-0.80)
  shape.bezierCurveTo(2.54, -1.42, 2.81, -1.16, 2.81, -0.80);

  // Edge-to-edge flank between forward and aft ducted rotors (subtle waist hugging the circular ducts)
  shape.bezierCurveTo(2.81, -0.35, 2.79, -0.15, 2.79, -0.05);
  shape.bezierCurveTo(2.79, 0.05, 2.81, 0.25, 2.81, 0.70);

  // Outer wing flank: contoured tightly edge-to-edge around the aft rotor (center X=2.05, Y=+0.70)
  shape.bezierCurveTo(2.81, 1.16, 2.54, 1.42, 2.15, 1.56);

  // Trailing edge sweeps smoothly inward behind aft rotors toward fuselage and tail
  shape.bezierCurveTo(1.94, 1.64, 1.75, 1.76, 1.48, 1.82);
  shape.bezierCurveTo(1.05, 1.98, 0.60, 2.55, 0.35, 2.88);
  shape.bezierCurveTo(0.20, 3.12, 0.08, 3.38, 0, 3.60);

  // Mirror Left Side:
  shape.bezierCurveTo(-0.08, 3.38, -0.20, 3.12, -0.35, 2.88);
  shape.bezierCurveTo(-0.60, 2.55, -1.05, 1.98, -1.48, 1.82);
  shape.bezierCurveTo(-1.75, 1.76, -1.94, 1.64, -2.15, 1.56);
  shape.bezierCurveTo(-2.54, 1.42, -2.81, 1.16, -2.81, 0.70);
  shape.bezierCurveTo(-2.81, 0.25, -2.79, 0.05, -2.79, -0.05);
  shape.bezierCurveTo(-2.79, -0.15, -2.81, -0.35, -2.81, -0.80);
  shape.bezierCurveTo(-2.81, -1.16, -2.54, -1.42, -2.15, -1.56);
  shape.bezierCurveTo(-1.94, -1.64, -1.75, -1.76, -1.48, -1.82);
  shape.bezierCurveTo(-0.98, -1.86, -0.60, -1.90, -0.44, -2.10);
  shape.bezierCurveTo(-0.24, -2.40, -0.08, -2.72, 0, noseY);

  // ── 4 Circular Rotor Duct Cutouts (matching outside.jpeg) ──
  const ductRadius = 0.70;
  const ductPositions2D: [number, number][] = [
    [-2.05, -0.80], // Port Forward
    [-2.05, 0.70], // Port Aft
    [2.05, -0.80], // Stbd Forward
    [2.05, 0.70], // Stbd Aft
  ];

  ductPositions2D.forEach(([dx, dy]) => {
    const hole = new THREE.Path();
    hole.absarc(dx, dy, ductRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  });

  return shape;
}

/* ── Prop Guard Mesh (Wireframe Cylinder Cage) ─────────── */

function PropGuard({ radius, height, color }: { radius: number; height: number; color: string }) {
  return (
    <group>
      {/* Outer ring top */}
      <mesh position={[0, height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.015, 8, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Outer ring bottom */}
      <mesh position={[0, -height / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.015, 8, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} />
      </mesh>
      {/* Vertical bars */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i / 12) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        return (
          <mesh key={i} position={[x, 0, z]}>
            <cylinderGeometry args={[0.012, 0.012, height, 6]} />
            <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} />
          </mesh>
        );
      })}
      {/* Mid ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, 0.012, 6, 32]} />
        <meshStandardMaterial color={color} roughness={0.4} metalness={0.8} />
      </mesh>
    </group>
  );
}

/* ── Pressure Sensor (Small Metallic Transducer) ──────── */

function PressureSensor({ fault, isHighlighted }: { fault?: FaultLevel; isHighlighted?: boolean }) {
  const baseColor = fault && fault !== "normal" ? faultColor(fault) : "#E0E0E0";
  const emissive = faultEmissive(fault || "normal", !!isHighlighted);
  const ei = faultEmissiveIntensity(fault || "normal", !!isHighlighted);

  return (
    <group>
      {/* Sensor body */}
      <mesh>
        <cylinderGeometry args={[0.06, 0.07, 0.12, 16]} />
        <meshStandardMaterial color={baseColor} roughness={0.25} metalness={0.85}
          emissive={emissive} emissiveIntensity={ei} />
      </mesh>
      {/* Threaded connector */}
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.06, 10]} />
        <meshStandardMaterial color="#D4AF37" roughness={0.35} metalness={0.9} />
      </mesh>
      {/* Electrical connector */}
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.04, 8]} />
        <meshStandardMaterial color="#4A5568" roughness={0.5} metalness={0.6} />
      </mesh>
    </group>
  );
}

/* ── H₂ Piping with Flow Arrows (Straight Line) ───────── */

function H2Piping({ points, fault, isHighlighted }: { points: THREE.Vector3[]; fault?: FaultLevel; isHighlighted?: boolean }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const tubeGeo = useMemo(() => new THREE.TubeGeometry(curve, 32, 0.028, 10, false), [curve]);
  const baseColor = fault && fault !== "normal" ? faultColor(fault) : "#CD7F32";
  const emissive = faultEmissive(fault || "normal", !!isHighlighted);
  const ei = faultEmissiveIntensity(fault || "normal", !!isHighlighted);

  // Flow direction arrows along the straight pipe
  const arrowPositions = useMemo(() => {
    const positions: { pos: THREE.Vector3; tangent: THREE.Vector3 }[] = [];
    for (let t = 0.25; t <= 0.85; t += 0.35) {
      positions.push({
        pos: curve.getPointAt(t),
        tangent: curve.getTangentAt(t),
      });
    }
    return positions;
  }, [curve]);

  return (
    <group>
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial color={baseColor} roughness={0.35} metalness={0.75}
          emissive={emissive} emissiveIntensity={ei} />
      </mesh>
      {/* Flow arrows */}
      {arrowPositions.map((ap, i) => (
        <mesh key={i} position={ap.pos}
          quaternion={new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), ap.tangent.clone().normalize()
          )}>
          <coneGeometry args={[0.038, 0.075, 8]} />
          <meshStandardMaterial color="#FFD700" roughness={0.25} metalness={0.85}
            emissive="#FFD700" emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Cooling Fin Array ─────────────────────────────────── */

function CoolingFins({ width, height, depth, count, color }: {
  width: number; height: number; depth: number; count: number; color: string;
}) {
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const z = ((i / (count - 1)) - 0.5) * depth;
        return (
          <mesh key={i} position={[0, height / 2 + 0.01, z]}>
            <boxGeometry args={[width * 0.95, 0.015, 0.02]} />
            <meshStandardMaterial color={color} roughness={0.25} metalness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

/* ── Electrical Cable ──────────────────────────────────── */

function Cable({ points, color, thickness = 0.012 }: {
  points: THREE.Vector3[]; color: string; thickness?: number;
}) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 20, thickness, 8, false), [curve, thickness]);
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.35} />
    </mesh>
  );
}


/* ═══════════════════════════════════════════════════════════
   MAIN DRONE MODEL COMPONENT
   ═══════════════════════════════════════════════════════════ */

export default function DroneModel({
  roll, pitch, yaw, connected, throttle = 0, theme, batteryPercent, h2TankPercent,
  viewMode, shellOpacity, explodedFactor, showLabels,
  highlightedComponent, faultOverrides,
}: DroneModelProps) {
  const groupRef = useRef<THREE.Group>(null!);
  const prop1Ref = useRef<THREE.Group>(null!);
  const prop2Ref = useRef<THREE.Group>(null!);
  const prop3Ref = useRef<THREE.Group>(null!);
  const prop4Ref = useRef<THREE.Group>(null!);
  const rearPropRef = useRef<THREE.Group>(null!);
  const batteryFillRef = useRef<THREE.Mesh>(null!);

  const { scene: gasCylinderScene } = useGLTF(GAS_CYLINDER_PATH);

  // Cylinder oriented horizontally along the straight centerline (Z axis)
  const gasCylinderModel = useMemo(() => {
    const clone = gasCylinderScene.clone();
    clone.rotation.x = Math.PI / 2;
    clone.rotation.y = Math.PI / 2;
    clone.rotation.z = Math.PI;
    const bbox = new THREE.Box3().setFromObject(clone);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    bbox.getCenter(center);
    bbox.getSize(size);
    clone.position.sub(center);
    const maxDim = Math.max(size.x, size.y, size.z);
    if (maxDim > 0) {
      const scaleFactor = 1.3 / maxDim;
      clone.scale.setScalar(scaleFactor);
    }
    const wrapper = new THREE.Group();
    wrapper.add(clone);
    return wrapper;
  }, [gasCylinderScene]);

  const isDark = theme === "dark";

  // ── Propeller geometries (scaled to 15-inch / 0.635m to sit cleanly inside 0.76m wing ducts) ──
  const liftPropGeo = useMemo(() => createPropellerGeometry(0.005), []);
  const liftBlurGeo = useMemo(() => createRotorBlurDiscGeometry(0.005), []);

  // ── Smoothed state ──
  const smoothed = useRef({ roll: 0, pitch: 0, yaw: 0 });
  const smoothedExploded = useRef(0);

  // ── Shared materials ──
  const liftPropMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isDark ? "#2a2e35" : "#555",
    roughness: 0.25, metalness: 0.4, transparent: true, opacity: 0.85,
  }), [isDark]);

  const liftBlurMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: isDark ? "#4FD8E0" : "#0F8E96",
    roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0,
    side: THREE.DoubleSide, depthWrite: false,
  }), [isDark]);

  // Battery fill material
  const smoothedBattery = useRef(batteryPercent);
  const batteryFillMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#4ADE80", transparent: true, opacity: 0.8,
    emissive: new THREE.Color("#22C55E"), emissiveIntensity: 0.5,
  }), []);

  // ── Wing shape ──
  const wingShape = useMemo(() => createWingShape(), []);
  const wingGeo = useMemo(() => {
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: 0.45,
      bevelEnabled: true,
      bevelThickness: 0.10,
      bevelSize: 0.05,
      bevelOffset: 0,
      bevelSegments: 8,
      curveSegments: 48,
    };
    const geo = new THREE.ExtrudeGeometry(wingShape, extrudeSettings);
    geo.translate(0, 0.45, -0.225);
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  }, [wingShape]);

  // ── Straight-Line H₂ Piping (aligned along X = 0) ──
  const h2PipePoints = useMemo(() => [
    new THREE.Vector3(0, 0.06, -0.85),  // cylinder outlet
    new THREE.Vector3(0, 0.06, -0.60),  // sensor 1
    new THREE.Vector3(0, 0.06, -0.20),  // regulator
    new THREE.Vector3(0, 0.06, 0.20),   // fuel cell stack inlet
  ], []);

  // ── Symmetrical Straight-Line Wiring Backbone (along X = 0) ──
  const batteryToPcb = useMemo(() => [
    new THREE.Vector3(0, -0.06, 1.70),
    new THREE.Vector3(0, -0.06, 2.05),
    new THREE.Vector3(0, -0.06, 2.45),
  ], []);

  const fuelCellToPcb = useMemo(() => [
    new THREE.Vector3(0, -0.06, 0.60),
    new THREE.Vector3(0, -0.06, 1.50),
    new THREE.Vector3(0, -0.06, 2.45),
  ], []);

  // ── Symmetrical Evenly-Spaced Motor Positions (encapsulated inside wing ducts) ──
  const motorPositions: [number, number, number][] = [
    [-2.05, 0, -0.35], // Motor 1: Port Forward Lift
    [-2.05, 0, 1.15], // Motor 2: Port Aft Lift
    [2.05, 0, -0.35], // Motor 3: Stbd Forward Lift
    [2.05, 0, 1.15], // Motor 4: Stbd Aft Lift
  ];

  // ── Animation Loop ──
  useFrame((_state, delta) => {
    if (!groupRef.current) return;
    const lerpFactor = 1 - Math.pow(0.05, delta);

    // Orientation
    const targetRoll = THREE.MathUtils.degToRad(roll);
    const targetPitch = THREE.MathUtils.degToRad(pitch);
    const targetYaw = THREE.MathUtils.degToRad(yaw);
    smoothed.current.roll = THREE.MathUtils.lerp(smoothed.current.roll, targetRoll, lerpFactor);
    smoothed.current.pitch = THREE.MathUtils.lerp(smoothed.current.pitch, targetPitch, lerpFactor);
    smoothed.current.yaw = THREE.MathUtils.lerp(smoothed.current.yaw, targetYaw, lerpFactor);
    groupRef.current.rotation.set(smoothed.current.pitch, smoothed.current.yaw, smoothed.current.roll);

    // Exploded view interpolation
    smoothedExploded.current = THREE.MathUtils.lerp(smoothedExploded.current, explodedFactor, lerpFactor);

    // Propeller spin: driven directly by live Master PCB ESC throttle
    let spinSpeed = 0;
    if (connected && throttle > 0) {
      const speedScale = (throttle / 100) * 75 + 15;
      spinSpeed = speedScale * delta;
      if (prop1Ref.current) prop1Ref.current.rotation.y += spinSpeed;
      if (prop2Ref.current) prop2Ref.current.rotation.y -= spinSpeed;
      if (prop3Ref.current) prop3Ref.current.rotation.y -= spinSpeed;
      if (prop4Ref.current) prop4Ref.current.rotation.y += spinSpeed;
      if (rearPropRef.current) rearPropRef.current.rotation.y += spinSpeed;
    }

    // Motion blur
    const normSpeed = Math.min(1, Math.abs(spinSpeed) / 0.3);
    const targetBladeOpacity = 0.85 - normSpeed * 0.70;
    const targetBlurOpacity = normSpeed * 0.10;
    liftPropMat.opacity = targetBladeOpacity;
    liftBlurMat.opacity = targetBlurOpacity;

    // Battery fill animation
    smoothedBattery.current = THREE.MathUtils.lerp(smoothedBattery.current, batteryPercent, lerpFactor);
    const batFrac = Math.max(0.001, smoothedBattery.current / 100);
    if (batteryFillRef.current) {
      batteryFillRef.current.scale.set(1, 1, batFrac);
      batteryFillRef.current.position.z = 0.35 - batFrac * 0.35;
    }
    const bp = smoothedBattery.current;
    if (bp > 30) {
      batteryFillMat.color.set("#4ADE80");
      batteryFillMat.emissive.set("#22C55E");
    } else if (bp > 15) {
      batteryFillMat.color.set("#FBBF24");
      batteryFillMat.emissive.set("#D97706");
    } else {
      batteryFillMat.color.set("#EF4444");
      batteryFillMat.emissive.set("#DC2626");
    }
  });

  // ── Helper: get component fault level ──
  const getFault = (id: string): FaultLevel => faultOverrides[id] || "normal";
  const isHighlighted = (id: string) => highlightedComponent === id;

  const setHighlightedComponent = useTwinViewStore((s) => s.setHighlightedComponent);

  const handleComponentClick = (id: string) => (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHighlightedComponent(highlightedComponent === id ? null : id);
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    document.body.style.cursor = "auto";
  };

  // ── Helper: compute exploded position ──
  const explodedPos = (id: string): [number, number, number] => {
    const offset = EXPLODED_OFFSETS[id];
    if (!offset) return [0, 0, 0];
    const f = smoothedExploded.current;
    return [offset[0] * f, offset[1] * f, offset[2] * f];
  };

  // ── Visibility checks ──
  const showShell = true;
  const shellVisible = groupOpacity(viewMode, "shell", shellOpacity);
  const h2Visible = groupOpacity(viewMode, "h2system", shellOpacity);
  const elecVisible = groupOpacity(viewMode, "electrical", shellOpacity);
  const frameVisible = groupOpacity(viewMode, "frame", shellOpacity);
  const propVisible = groupOpacity(viewMode, "propulsion", shellOpacity);
  const internalsVisible = viewMode !== "external";

  /* ── Structural Frame Color ── */
  const armColor = isDark ? "#2C3542" : "#475569";
  const motorColor = isDark ? "#334155" : "#64748B";

  /* ── Crystal Clear Shell Material (NO dark black tint!) ── */
  const isExternalView = viewMode === "external";
  const shellColor = isExternalView ? (isDark ? "#1E293B" : "#334155") : (isDark ? "#D8EAF8" : "#F1F5F9");

  return (
    <group ref={groupRef}>

      {/* ═══════════════════════════════════════════════════
          OUTER SHELL — Flying Wing (Crystal Clear Composite)
          ═══════════════════════════════════════════════════ */}
      {showShell && (
        <group
          position={explodedPos("shell")}
          onClick={isExternalView ? handleComponentClick("shell") : undefined}
          onPointerOver={isExternalView ? handlePointerOver : undefined}
          onPointerOut={isExternalView ? handlePointerOut : undefined}
        >
          <mesh geometry={wingGeo}>
            <meshPhysicalMaterial
              color={shellColor}
              roughness={isExternalView ? 0.25 : 0.04}
              metalness={isExternalView ? 0.35 : 0.05}
              transparent
              opacity={isExternalView ? 1.0 : Math.min(shellVisible, 0.22)}
              transmission={isExternalView ? 0.0 : 0.94}
              thickness={0.3}
              ior={1.45}
              clearcoat={1.0}
              clearcoatRoughness={0.03}
              envMapIntensity={1.8}
              side={THREE.DoubleSide}
              depthWrite={isExternalView}
            />
          </mesh>

          {/* Vertical stabilizer fins */}
          <mesh position={[-0.2, 0.25, 2.8]}>
            <boxGeometry args={[0.03, 0.4, 0.35]} />
            <meshPhysicalMaterial
              color={shellColor}
              roughness={isExternalView ? 0.25 : 0.05}
              metalness={0.2}
              transparent
              opacity={isExternalView ? 1.0 : Math.min(shellVisible, 0.25)}
              transmission={isExternalView ? 0.0 : 0.9}
              side={THREE.DoubleSide}
              depthWrite={isExternalView}
            />
          </mesh>
          <mesh position={[0.2, 0.25, 2.8]}>
            <boxGeometry args={[0.03, 0.4, 0.35]} />
            <meshPhysicalMaterial
              color={shellColor}
              roughness={isExternalView ? 0.25 : 0.05}
              metalness={0.2}
              transparent
              opacity={isExternalView ? 1.0 : Math.min(shellVisible, 0.25)}
              transmission={isExternalView ? 0.0 : 0.9}
              side={THREE.DoubleSide}
              depthWrite={isExternalView}
            />
          </mesh>

          <TwinLabel
            id="shell"
            text="UAV OUTER SHELL"
            showLabels={showLabels && isExternalView}
            highlightedComponent={highlightedComponent}
            position={[0, 0.6, -2]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          INTERNAL STRUCTURAL FRAME (Symmetrical Chassis)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={explodedPos("frame")}
          onClick={handleComponentClick("frame")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Main longitudinal beams (symmetric left and right) */}
          <mesh position={[-0.42, -0.15, 0.55]}>
            <boxGeometry args={[0.08, 0.08, 4.30]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>
          <mesh position={[0.42, -0.15, 0.55]}>
            <boxGeometry args={[0.08, 0.08, 4.30]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>

          {/* Cross beams along the straight spine */}
          {[-1.55, -0.80, 0.0, 0.80, 1.60, 2.40, 2.65].map((z, i) => (
            <mesh key={`cross-${i}`} position={[0, -0.15, z]}>
              <boxGeometry args={[0.92, 0.06, 0.06]} />
              <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
                transparent opacity={frameVisible} />
            </mesh>
          ))}

          {/* Central mounting spine plate */}
          <mesh position={[0, -0.22, 0.55]}>
            <boxGeometry args={[0.88, 0.02, 4.30]} />
            <meshStandardMaterial color={armColor} roughness={0.5} metalness={0.7}
              transparent opacity={frameVisible * 0.8} />
          </mesh>

          {/* Symmetrical motor arm extensions (aligned with wing ducts) */}
          <mesh position={[-1.24, -0.1, -0.35]}>
            <boxGeometry args={[1.65, 0.07, 0.1]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>
          <mesh position={[-1.24, -0.1, 1.15]}>
            <boxGeometry args={[1.65, 0.07, 0.1]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>
          <mesh position={[1.24, -0.1, -0.35]}>
            <boxGeometry args={[1.65, 0.07, 0.1]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>
          <mesh position={[1.24, -0.1, 1.15]}>
            <boxGeometry args={[1.65, 0.07, 0.1]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>
          {/* Rear thruster centerline arm */}
          <mesh position={[0, -0.1, 3.32]}>
            <boxGeometry args={[0.12, 0.08, 1.3]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={frameVisible} />
          </mesh>

          <TwinLabel
            id="frame"
            text="STRUCTURAL FRAME"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, -0.35, 0.55]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          1. H₂ CYLINDER (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.h2cylinder[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.h2cylinder[1] * smoothedExploded.current),
            -1.35 + (EXPLODED_OFFSETS.h2cylinder[2] * smoothedExploded.current),
          ]}
          rotation={[0, Math.PI, 0]}
          onClick={handleComponentClick("h2cylinder")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <primitive object={gasCylinderModel} />

          {/* Symmetrical mounting straps */}
          <mesh position={[0, -0.35, -0.3]}>
            <boxGeometry args={[0.3, 0.06, 0.08]} />
            <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.8} />
          </mesh>
          <mesh position={[0, -0.35, 0.3]}>
            <boxGeometry args={[0.3, 0.06, 0.08]} />
            <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.8} />
          </mesh>

          <TwinLabel
            id="h2cylinder"
            text="H₂ CYLINDER"
            subtext={`${Math.round(h2TankPercent)}% · 526mm`}
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.55, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          2. PRESSURE SENSOR 1 (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.sensor1[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.sensor1[1] * smoothedExploded.current),
            -0.60 + (EXPLODED_OFFSETS.sensor1[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("sensor1")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <PressureSensor fault={getFault("sensor1")} isHighlighted={isHighlighted("sensor1")} />
          <TwinLabel
            id="sensor1"
            text="PRESSURE SENSOR 1"
            subtext="TANK OUTLET"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.25, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          3. H₂ PRESSURE REGULATOR (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.regulator[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.regulator[1] * smoothedExploded.current),
            -0.20 + (EXPLODED_OFFSETS.regulator[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("regulator")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Regulator body */}
          <mesh>
            <boxGeometry args={[0.18, 0.14, 0.12]} />
            <meshStandardMaterial color="#D4AF37" roughness={0.25} metalness={0.9}
              emissive={faultEmissive(getFault("regulator"), isHighlighted("regulator"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("regulator"), isHighlighted("regulator"))} />
          </mesh>
          {/* Symmetrical red valve caps */}
          <mesh position={[0.08, 0.08, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 10]} />
            <meshStandardMaterial color="#EF4444" roughness={0.3} metalness={0.4} />
          </mesh>
          <mesh position={[-0.08, 0.08, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.04, 10]} />
            <meshStandardMaterial color="#EF4444" roughness={0.3} metalness={0.4} />
          </mesh>
          {/* Straight inlet/outlet fittings */}
          <mesh position={[0, 0, -0.08]}>
            <cylinderGeometry args={[0.025, 0.03, 0.06, 10]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.08]}>
            <cylinderGeometry args={[0.025, 0.03, 0.06, 10]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.2} metalness={0.9} />
          </mesh>

          <TwinLabel
            id="regulator"
            text="H₂ REGULATOR"
            subtext="DUAL VALVE"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.25, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          4. H₂ PIPING (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            EXPLODED_OFFSETS.h2piping[0] * smoothedExploded.current,
            EXPLODED_OFFSETS.h2piping[1] * smoothedExploded.current,
            EXPLODED_OFFSETS.h2piping[2] * smoothedExploded.current,
          ]}
          onClick={handleComponentClick("h2piping")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <H2Piping points={h2PipePoints} fault={getFault("h2piping")} isHighlighted={isHighlighted("h2piping")} />
          <TwinLabel
            id="h2piping"
            text="H₂ SUPPLY LINE"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.22, 0.0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          5. FUEL CELL STACK (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.fuelcell[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.fuelcell[1] * smoothedExploded.current),
            0.60 + (EXPLODED_OFFSETS.fuelcell[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("fuelcell")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Main stack body */}
          <mesh>
            <boxGeometry args={[0.55, 0.35, 0.72]} />
            <meshStandardMaterial
              color={getFault("fuelcell") !== "normal" ? faultColor(getFault("fuelcell")) : "#E2E8F0"}
              roughness={0.25} metalness={0.85}
              emissive={faultEmissive(getFault("fuelcell"), isHighlighted("fuelcell"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("fuelcell"), isHighlighted("fuelcell"))}
              transparent opacity={h2Visible} />
          </mesh>
          {/* Cooling fins on top */}
          <CoolingFins width={0.52} height={0.35} depth={0.68} count={8} color="#CBD5E1" />
          {/* End plates */}
          <mesh position={[0, 0, 0.37]}>
            <boxGeometry args={[0.57, 0.37, 0.02]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.8}
              transparent opacity={h2Visible} />
          </mesh>
          <mesh position={[0, 0, -0.37]}>
            <boxGeometry args={[0.57, 0.37, 0.02]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.8}
              transparent opacity={h2Visible} />
          </mesh>
          {/* Symmetrical cooling fans */}
          <mesh position={[0.29, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.03, 20]} />
            <meshStandardMaterial color="#1E293B" roughness={0.4} metalness={0.7}
              transparent opacity={h2Visible} />
          </mesh>
          <mesh position={[-0.29, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.11, 0.11, 0.03, 20]} />
            <meshStandardMaterial color="#1E293B" roughness={0.4} metalness={0.7}
              transparent opacity={h2Visible} />
          </mesh>
          {/* Symmetrical electrical terminals */}
          <mesh position={[0.15, 0.19, 0.15]}>
            <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
            <meshStandardMaterial color="#D97706" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[-0.15, 0.19, 0.15]}>
            <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
            <meshStandardMaterial color="#D97706" roughness={0.2} metalness={0.9} />
          </mesh>

          <TwinLabel
            id="fuelcell"
            text="FUEL CELL STACK"
            subtext="PEM SYSTEM"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.42, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          6. PRESSURE SENSOR 2 (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.sensor2[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.sensor2[1] * smoothedExploded.current),
            1.10 + (EXPLODED_OFFSETS.sensor2[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("sensor2")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <PressureSensor fault={getFault("sensor2")} isHighlighted={isHighlighted("sensor2")} />
          <TwinLabel
            id="sensor2"
            text="PRESSURE SENSOR 2"
            subtext="FC INLET"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.25, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          7. BATTERY PACK (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.battery[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.battery[1] * smoothedExploded.current),
            1.70 + (EXPLODED_OFFSETS.battery[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("battery")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Battery outer casing */}
          <mesh>
            <boxGeometry args={[0.52, 0.30, 0.72]} />
            <meshStandardMaterial
              color={getFault("battery") !== "normal" ? faultColor(getFault("battery")) : "#22C55E"}
              roughness={0.25} metalness={0.4}
              emissive={faultEmissive(getFault("battery"), isHighlighted("battery"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("battery"), isHighlighted("battery"))}
              transparent opacity={Math.min(elecVisible, 0.2)}
              side={THREE.DoubleSide} depthWrite={false}
            />
          </mesh>
          {/* Battery fill level */}
          <mesh ref={batteryFillRef}>
            <boxGeometry args={[0.48, 0.26, 0.68]} />
            <primitive object={batteryFillMat} attach="material" />
          </mesh>
          {/* Symmetrical battery terminals */}
          <mesh position={[0.15, 0.16, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
            <meshStandardMaterial color="#EF4444" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[-0.15, 0.16, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.04, 8]} />
            <meshStandardMaterial color="#1E293B" roughness={0.2} metalness={0.9} />
          </mesh>

          <TwinLabel
            id="battery"
            text="BATTERY PACK"
            subtext={`${Math.round(batteryPercent)}%`}
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.42, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          8. PCB / POWER MANAGEMENT (Straight Line on Centerline X = 0)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.pcb[0] * smoothedExploded.current),
            0.06 + (EXPLODED_OFFSETS.pcb[1] * smoothedExploded.current),
            2.45 + (EXPLODED_OFFSETS.pcb[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("pcb")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Symmetrical transparent acrylic enclosure */}
          <mesh>
            <boxGeometry args={[0.55, 0.28, 0.45]} />
            <meshPhysicalMaterial
              color="#FFFFFF" roughness={0.03} metalness={0.0}
              transparent opacity={0.16}
              transmission={0.88} thickness={0.2} ior={1.49}
              side={THREE.DoubleSide} depthWrite={false}
            />
          </mesh>
          {/* Main PCB board */}
          <mesh position={[0, -0.05, 0]}>
            <boxGeometry args={[0.48, 0.025, 0.38]} />
            <meshStandardMaterial color="#059669" roughness={0.35} metalness={0.6}
              emissive={faultEmissive(getFault("pcb"), isHighlighted("pcb"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("pcb"), isHighlighted("pcb"))} />
          </mesh>
          {/* Central Microcontroller IC */}
          <mesh position={[0, 0.0, 0]}>
            <boxGeometry args={[0.12, 0.03, 0.12]} />
            <meshStandardMaterial color="#0F172A" roughness={0.25} metalness={0.7} />
          </mesh>
          {/* Symmetrical DC/DC converter modules */}
          <mesh position={[-0.14, 0.02, 0.08]}>
            <boxGeometry args={[0.1, 0.06, 0.08]} />
            <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0.14, 0.02, 0.08]}>
            <boxGeometry args={[0.1, 0.06, 0.08]} />
            <meshStandardMaterial color="#1E293B" roughness={0.35} metalness={0.7} />
          </mesh>
          {/* Symmetrical capacitors */}
          {[-0.12, 0, 0.12].map((x, i) => (
            <mesh key={`cap-${i}`} position={[x, 0.03, -0.12]}>
              <cylinderGeometry args={[0.015, 0.015, 0.04, 10]} />
              <meshStandardMaterial color="#1E3A8A" roughness={0.35} metalness={0.6} />
            </mesh>
          ))}
          {/* Symmetrical connectors */}
          <mesh position={[0.18, 0.0, 0.14]}>
            <boxGeometry args={[0.06, 0.03, 0.04]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[-0.18, 0.0, 0.14]}>
            <boxGeometry args={[0.06, 0.03, 0.04]} />
            <meshStandardMaterial color="#F8FAFC" roughness={0.4} metalness={0.4} />
          </mesh>

          <TwinLabel
            id="pcb"
            text="POWER MGMT PCB"
            subtext="MAIN CONTROL"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, 0.36, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          9. ELECTRICAL WIRING HARNESS (Straight Spine & Branches)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && (
        <group
          position={[
            EXPLODED_OFFSETS.wiring[0] * smoothedExploded.current,
            EXPLODED_OFFSETS.wiring[1] * smoothedExploded.current,
            EXPLODED_OFFSETS.wiring[2] * smoothedExploded.current,
          ]}
          onClick={handleComponentClick("wiring")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          {/* Central power backbone cables (straight along X = 0) */}
          <Cable points={batteryToPcb} color="#EA580C" thickness={0.016} />
          <Cable points={fuelCellToPcb} color="#2563EB" thickness={0.015} />

          {/* Symmetrical branch signal/power wires to each ESC */}
          {motorPositions.map((mp, i) => (
            <Cable key={`esc-wire-${i}`}
              points={[
                new THREE.Vector3(0, -0.06, 2.45),
                new THREE.Vector3(mp[0] * 0.45, -0.08, mp[2]),
                new THREE.Vector3(mp[0] * 0.72, -0.08, mp[2]),
                new THREE.Vector3(mp[0], mp[1] - 0.05, mp[2]),
              ]}
              color="#3B82F6" thickness={0.007}
            />
          ))}

          {/* Straight line to Rear ESC & Motor 5 */}
          <Cable
            points={[
              new THREE.Vector3(0, -0.06, 2.45),
              new THREE.Vector3(0, -0.06, 2.80),
              new THREE.Vector3(0, 0.05, 3.20),
            ]}
            color="#3B82F6" thickness={0.008}
          />

          <TwinLabel
            id="wiring"
            text="WIRING HARNESS"
            showLabels={showLabels}
            highlightedComponent={highlightedComponent}
            position={[0, -0.12, 1.45]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          10. ESCs 1–4 (Symmetrical on Motor Arms)
          ═══════════════════════════════════════════════════ */}
      {internalsVisible && motorPositions.map((mp, i) => {
        const escId = `esc${i + 1}`;
        const escOffset = EXPLODED_OFFSETS[escId] || [0, 0, 0];
        const highlighted = isHighlighted(escId);
        return (
          <group
            key={escId}
            position={[
              mp[0] * 0.75 + escOffset[0] * smoothedExploded.current,
              -0.08 + escOffset[1] * smoothedExploded.current,
              mp[2] + escOffset[2] * smoothedExploded.current,
            ]}
            onClick={handleComponentClick(escId)}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <mesh>
              <boxGeometry args={[0.12, 0.04, 0.08]} />
              <meshStandardMaterial color={getFault(escId) !== "normal" ? faultColor(getFault(escId)) : "#1E293B"}
                roughness={0.35} metalness={0.7}
                emissive={faultEmissive(getFault(escId), highlighted)}
                emissiveIntensity={faultEmissiveIntensity(getFault(escId), highlighted)}
                transparent opacity={elecVisible} />
            </mesh>
            <TwinLabel
              id={escId}
              text={`ESC ${i + 1}`}
              showLabels={showLabels && elecVisible > 0.2}
              highlightedComponent={highlightedComponent}
              position={[0, 0.14, 0]}
            />
          </group>
        );
      })}

      {/* Rear ESC (Straight on Centerline X = 0) */}
      {internalsVisible && (
        <group
          position={[
            0 + (EXPLODED_OFFSETS.esc5[0] * smoothedExploded.current),
            -0.06 + (EXPLODED_OFFSETS.esc5[1] * smoothedExploded.current),
            2.80 + (EXPLODED_OFFSETS.esc5[2] * smoothedExploded.current),
          ]}
          onClick={handleComponentClick("esc5")}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <mesh>
            <boxGeometry args={[0.12, 0.04, 0.08]} />
            <meshStandardMaterial color={getFault("esc5") !== "normal" ? faultColor(getFault("esc5")) : "#1E293B"}
              roughness={0.35} metalness={0.7}
              emissive={faultEmissive(getFault("esc5"), isHighlighted("esc5"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("esc5"), isHighlighted("esc5"))}
              transparent opacity={elecVisible} />
          </mesh>
          <TwinLabel
            id="esc5"
            text="ESC 5"
            showLabels={showLabels && elecVisible > 0.2}
            highlightedComponent={highlightedComponent}
            position={[0, 0.14, 0]}
          />
        </group>
      )}


      {/* ═══════════════════════════════════════════════════
          11. MOTORS 1–4 (Symmetrical Wing Corners) + PROP GUARDS
          ═══════════════════════════════════════════════════ */}
      {motorPositions.map((mp, i) => {
        const motorId = `motor${i + 1}`;
        const motorOffset = EXPLODED_OFFSETS[motorId] || [0, 0, 0];
        const propRef = [prop1Ref, prop2Ref, prop3Ref, prop4Ref][i];
        const fault = getFault(motorId);
        const highlighted = isHighlighted(motorId);

        return (
          <group
            key={motorId}
            position={[
              mp[0] + motorOffset[0] * smoothedExploded.current,
              mp[1] + motorOffset[1] * smoothedExploded.current,
              mp[2] + motorOffset[2] * smoothedExploded.current,
            ]}
            onClick={handleComponentClick(motorId)}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            {/* Motor mount leg */}
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.05, 0.06, 0.3, 10]} />
              <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
                transparent opacity={propVisible} />
            </mesh>
            {/* Motor housing */}
            <mesh position={[0, 0.08, 0]}>
              <cylinderGeometry args={[0.16, 0.18, 0.22, 18]} />
              <meshStandardMaterial
                color={fault !== "normal" ? faultColor(fault) : motorColor}
                roughness={0.25} metalness={0.85}
                emissive={faultEmissive(fault, highlighted)}
                emissiveIntensity={faultEmissiveIntensity(fault, highlighted)}
                transparent opacity={propVisible} />
            </mesh>

            {/* Prop guard cage */}
            <group position={[0, 0.3, 0]}>
              <PropGuard radius={0.65} height={0.25} color={armColor} />
            </group>

            {/* Propeller + blur disc */}
            <group ref={propRef} position={[0, 0.28, 0]}>
              <mesh geometry={liftPropGeo} material={liftPropMat} />
              <mesh geometry={liftBlurGeo} material={liftBlurMat} rotation={[Math.PI / 2, 0, 0]} />
            </group>

            <TwinLabel
              id={motorId}
              text={`MOTOR ${i + 1}`}
              subtext={i < 2 ? "PORT LIFT" : "STBD LIFT"}
              showLabels={showLabels && propVisible > 0.2}
              highlightedComponent={highlightedComponent}
              position={[0, 0.52, 0]}
            />
          </group>
        );
      })}


      {/* ═══════════════════════════════════════════════════
          12. MOTOR 5 — REAR THRUSTER (Mounted Outside Shell Trailing Edge)
          ═══════════════════════════════════════════════════ */}
      <group
        position={[
          0 + (EXPLODED_OFFSETS.motor5[0] * smoothedExploded.current),
          0 + (EXPLODED_OFFSETS.motor5[1] * smoothedExploded.current),
          3.95 + (EXPLODED_OFFSETS.motor5[2] * smoothedExploded.current),
        ]}
        onClick={handleComponentClick("motor5")}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Symmetrical centerline tail boom extending from frame through tail */}
        <mesh position={[0, 0, -0.6]}>
          <boxGeometry args={[0.08, 0.08, 1.2]} />
          <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
            transparent opacity={propVisible} />
        </mesh>

        {/* Longitudinal Motor & Propeller Assembly: shaft on Z-axis, prop in XY plane facing +Z */}
        <group rotation={[Math.PI / 2, 0, 0]}>
          {/* Motor mount bracket */}
          <mesh position={[0, -0.15, 0]}>
            <cylinderGeometry args={[0.05, 0.06, 0.3, 10]} />
            <meshStandardMaterial color={armColor} roughness={0.4} metalness={0.8}
              transparent opacity={propVisible} />
          </mesh>
          {/* Motor housing */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.16, 0.18, 0.22, 18]} />
            <meshStandardMaterial
              color={getFault("motor5") !== "normal" ? faultColor(getFault("motor5")) : motorColor}
              roughness={0.25} metalness={0.85}
              emissive={faultEmissive(getFault("motor5"), isHighlighted("motor5"))}
              emissiveIntensity={faultEmissiveIntensity(getFault("motor5"), isHighlighted("motor5"))}
              transparent opacity={propVisible} />
          </mesh>

          {/* Rear propeller + blur disc (mounted outside outer shell) */}
          <group ref={rearPropRef} position={[0, 0.28, 0]}>
            <mesh geometry={liftPropGeo} material={liftPropMat} />
            <mesh geometry={liftBlurGeo} material={liftBlurMat} rotation={[Math.PI / 2, 0, 0]} />
          </group>
        </group>

        <TwinLabel
          id="motor5"
          text="REAR THRUST MOTOR"
          subtext="LONGITUDINAL PUSHER"
          showLabels={showLabels && propVisible > 0.2}
          highlightedComponent={highlightedComponent}
          position={[0, 0.52, 0]}
        />
      </group>

    </group>
  );
}

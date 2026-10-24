/* ────────────────────────────────────────────────────────
   AEROTWIN — RADAR GRID
   Procedural radar-style grid for the 3D viewport floor.
   Concentric rings + radial spokes + crosshair axes.
   Accepts theme-driven colors.
   ──────────────────────────────────────────────────────── */

import { useMemo } from "react";
import * as THREE from "three";


interface RadarGridProps {
  rings?: number;
  spokes?: number;
  radius?: number;
  ringColor?: string;
  ringOpacity?: number;
  axisColor?: string;
  axisOpacity?: number;
  centerColor?: string;
}


export default function RadarGrid({
  rings = 8,
  spokes = 12,
  radius = 12,
  ringColor = "#1a3040",
  ringOpacity = 0.5,
  axisColor = "#1a4050",
  axisOpacity = 0.7,
  centerColor = "#4FD8E0",
}: RadarGridProps) {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    // --- Concentric rings ---
    for (let r = 1; r <= rings; r++) {
      const ringRadius = (r / rings) * radius;
      const segments = 96;
      for (let s = 0; s <= segments; s++) {
        const theta = (s / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(
          Math.cos(theta) * ringRadius,
          0,
          Math.sin(theta) * ringRadius,
        ));
        if (s < segments) {
          const thetaNext = ((s + 1) / segments) * Math.PI * 2;
          points.push(new THREE.Vector3(
            Math.cos(thetaNext) * ringRadius,
            0,
            Math.sin(thetaNext) * ringRadius,
          ));
        }
      }
    }

    // --- Radial spokes ---
    for (let s = 0; s < spokes; s++) {
      const theta = (s / spokes) * Math.PI * 2;
      points.push(new THREE.Vector3(0, 0, 0));
      points.push(new THREE.Vector3(
        Math.cos(theta) * radius,
        0,
        Math.sin(theta) * radius,
      ));
    }

    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      positions[i * 3]     = points[i].x;
      positions[i * 3 + 1] = points[i].y;
      positions[i * 3 + 2] = points[i].z;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [rings, spokes, radius]);

  // Axis crosshairs
  const axisGeometry = useMemo(() => {
    const pts: number[] = [];
    pts.push(-radius, 0, 0, radius, 0, 0);
    pts.push(0, 0, -radius, 0, 0, radius);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return geo;
  }, [radius]);

  return (
    <group position={[0, -0.5, 0]}>
      {/* Grid rings + spokes */}
      <lineSegments geometry={geometry}>
        <lineBasicMaterial color={ringColor} transparent opacity={ringOpacity} />
      </lineSegments>

      {/* Axis crosshairs */}
      <lineSegments geometry={axisGeometry}>
        <lineBasicMaterial color={axisColor} transparent opacity={axisOpacity} />
      </lineSegments>

      {/* Center dot */}
      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.08, 16]} />
        <meshBasicMaterial color={centerColor} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

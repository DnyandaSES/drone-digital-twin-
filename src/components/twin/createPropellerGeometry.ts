/* ────────────────────────────────────────────────────────
   AEROTWIN — PROCEDURAL PROPELLER GEOMETRY
   Generates a two-blade propeller via cross-section lofting
   using an exact blade-profile specification (radius + twist).
   ──────────────────────────────────────────────────────── */

import * as THREE from "three";

// ─── Blade Profile Data ──────────────────────────────────
// t = normalised span [0 hub … 1 tip]
// r = radius from central axis (units)
// angle = twist of cross-section around the central axis (degrees)
const BLADE_PROFILE: { t: number; r: number; angle: number }[] = [
  { t: 0.0,  r: 5.9,  angle: -29 },
  { t: 0.08, r: 9.4,  angle: -21 },
  { t: 0.15, r: 11.7, angle: -19 },
  { t: 0.23, r: 13.5, angle: -18 },
  { t: 0.31, r: 14.6, angle: -18 },
  { t: 0.38, r: 15.3, angle: -18 },
  { t: 0.46, r: 15.7, angle: -20 }, // widest
  { t: 0.54, r: 15.6, angle: -21 },
  { t: 0.62, r: 15.1, angle: -23 },
  { t: 0.69, r: 14.1, angle: -27 },
  { t: 0.77, r: 12.5, angle: -32 },
  { t: 0.85, r: 10.3, angle: -41 },
  { t: 0.92, r: 8.0,  angle: -53 },
  { t: 1.0,  r: 10.3, angle: -39 }, // -39° is 141° mod 180° continuous with -53° to prevent tip twist spike
];

// Central axis total length = 254 units → half = 127 units
const HALF_AXIS = 127;

// Cross-section resolution (points around the airfoil profile)
const AIRFOIL_PTS = 24;

// Span-wise resolution (number of interpolated stations per blade)
const SPAN_STATIONS = 60;

// ─── Catmull-Rom Spline Interpolation ────────────────────
/** Evaluate Catmull-Rom spline at parameter u ∈ [0,1] given four control values */
function catmullRom(p0: number, p1: number, p2: number, p3: number, u: number): number {
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  );
}

/** Interpolate a property from the blade profile using Catmull-Rom */
function interpolateProfile(tNorm: number, prop: "r" | "angle"): number {
  const n = BLADE_PROFILE.length;
  const tClamped = Math.max(0, Math.min(1, tNorm));

  // Find the segment
  let idx = 0;
  for (let i = 0; i < n - 1; i++) {
    if (BLADE_PROFILE[i + 1].t >= tClamped) {
      idx = i;
      break;
    }
  }

  const seg0 = BLADE_PROFILE[idx];
  const seg1 = BLADE_PROFILE[Math.min(idx + 1, n - 1)];
  const segLen = seg1.t - seg0.t;
  const u = segLen > 1e-9 ? (tClamped - seg0.t) / segLen : 0;

  // Catmull-Rom needs 4 points: clamp at boundaries
  const p0 = BLADE_PROFILE[Math.max(idx - 1, 0)][prop];
  const p1 = seg0[prop];
  const p2 = seg1[prop];
  const p3 = BLADE_PROFILE[Math.min(idx + 2, n - 1)][prop];

  return catmullRom(p0, p1, p2, p3, u);
}

// ─── Airfoil Cross-Section ──────────────────────────────
/**
 * Generate a 2D airfoil-like profile (thin, rounded leading edge,
 * sharp trailing edge) with given chord (width) and thickness.
 * Returns points in the YZ plane (Y = chord direction, Z = thickness direction).
 */
function airfoilPoints(chord: number, thickness: number, nPts: number): THREE.Vector2[] {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < nPts; i++) {
    // Parameter goes around the airfoil: 0..1 upper, then 1..0 lower
    const frac = i / (nPts - 1);
    let x: number; // chord-wise position, -0.5..+0.5 of chord
    let y: number; // thickness offset

    if (frac <= 0.5) {
      // Upper surface: leading edge (left) to trailing edge (right)
      const t2 = frac * 2; // 0..1
      x = -0.5 + t2; // -0.5 → +0.5
      // NACA-like thickness distribution (simplified)
      const xn = t2; // normalised chord 0..1
      // Classic NACA 4-digit thickness formula
      y = (thickness / 0.2) * (
        0.2969 * Math.sqrt(xn) -
        0.126 * xn -
        0.3516 * xn * xn +
        0.2843 * xn * xn * xn -
        0.1015 * xn * xn * xn * xn
      );
    } else {
      // Lower surface: trailing edge back to leading edge
      const t2 = (1 - frac) * 2; // 1..0
      x = -0.5 + t2;
      const xn = t2;
      y = -(thickness / 0.2) * (
        0.2969 * Math.sqrt(xn) -
        0.126 * xn -
        0.3516 * xn * xn +
        0.2843 * xn * xn * xn -
        0.1015 * xn * xn * xn * xn
      );
    }

    pts.push(new THREE.Vector2(x * chord, y));
  }
  return pts;
}

// ─── Hub Geometry ────────────────────────────────────────
function createHubGeometry(hubRadius: number, hubLength: number): THREE.BufferGeometry {
  // Simple tapered cylinder for the central hub
  const geo = new THREE.CylinderGeometry(
    hubRadius * 0.85,  // top radius (slightly tapered)
    hubRadius,         // bottom radius
    hubLength,
    24,
    1,
    false,
  );
  // Rotate so the cylinder axis aligns with the propeller spin axis (Y by default for CylinderGeometry, which is correct for our vertical spin)
  return geo;
}

// ─── Main Propeller Geometry Builder ────────────────────
/**
 * Creates a complete two-blade propeller BufferGeometry.
 * Built directly in horizontal rotor orientation:
 * - Hub axis = vertical Y axis
 * - Blade 1 span = extends along +X axis
 * - Blade 2 span = extends along -X axis (180° rotation + mirror symmetry)
 * @param scale - uniform scale factor to fit the drone mount points
 */
export function createPropellerGeometry(scale: number = 1): THREE.BufferGeometry {
  const allGeometries: THREE.BufferGeometry[] = [];

  // Build two blades: Blade 1 (+X direction), Blade 2 (-X direction)
  for (let bladeIdx = 0; bladeIdx < 2; bladeIdx++) {
    const flipSign = bladeIdx === 0 ? 1 : -1;
    // 180° rotation + mirror symmetry for blade 2
    const angleSign = bladeIdx === 0 ? 1 : -1;

    // Generate cross-section rings along the blade span (X axis)
    const rings: THREE.Vector3[][] = [];

    for (let si = 0; si <= SPAN_STATIONS; si++) {
      const tNorm = si / SPAN_STATIONS;

      // Interpolate radius and angle at this station
      const radius = interpolateProfile(tNorm, "r") * scale;
      const angleDeg = interpolateProfile(tNorm, "angle") * angleSign;
      const angleRad = THREE.MathUtils.degToRad(angleDeg);

      // Spanwise position along the X axis
      const xPos = tNorm * HALF_AXIS * scale * flipSign;

      // Blade thickness tapers from max at widest to thin at hub/tip
      const tipFactor = tNorm > 0.9 ? Math.sin(((1 - tNorm) / 0.1) * (Math.PI / 2)) : 1;
      const thicknessProfile = Math.sin(tNorm * Math.PI) * tipFactor;
      const maxThickness = 13 * scale;
      const thickness = Math.max(0.2 * scale, thicknessProfile * maxThickness * 0.5);

      // Chord (width of airfoil) = 2 * radius, rounded at tip
      const chord = radius * 2 * (tNorm > 0.92 ? Math.cos(((tNorm - 0.92) / 0.08) * (Math.PI / 2)) : 1);

      // Generate 2D airfoil cross-section points
      const airfoil2D = airfoilPoints(chord, thickness, AIRFOIL_PTS);

      // Transform 2D airfoil into 3D:
      // Airfoil lies in YZ plane (Z = chord direction, Y = thickness direction)
      // Rotated by twist angle around the X (span) axis
      const ring: THREE.Vector3[] = [];
      for (const pt of airfoil2D) {
        // pt.x = chord (Z axis), pt.y = thickness (Y axis)
        const rz = pt.x * Math.cos(angleRad) - pt.y * Math.sin(angleRad);
        const ry = pt.x * Math.sin(angleRad) + pt.y * Math.cos(angleRad);
        ring.push(new THREE.Vector3(xPos, ry, rz));
      }
      rings.push(ring);
    }

    // Loft rings into triangles
    const vertices: number[] = [];
    const indices: number[] = [];

    for (const ring of rings) {
      for (const v of ring) {
        vertices.push(v.x, v.y, v.z);
      }
    }

    const nPts = AIRFOIL_PTS;
    for (let si = 0; si < SPAN_STATIONS; si++) {
      for (let pi = 0; pi < nPts; pi++) {
        const nextPi = (pi + 1) % nPts;

        const i0 = si * nPts + pi;
        const i1 = si * nPts + nextPi;
        const i2 = (si + 1) * nPts + pi;
        const i3 = (si + 1) * nPts + nextPi;

        if (bladeIdx === 0) {
          indices.push(i0, i2, i1);
          indices.push(i1, i2, i3);
        } else {
          indices.push(i0, i1, i2);
          indices.push(i1, i3, i2);
        }
      }
    }

    // Cap hub end (si = 0)
    const hubCenterIdx = vertices.length / 3;
    const hubRing = rings[0];
    vertices.push(hubRing[0].x, 0, 0);
    for (let pi = 0; pi < nPts; pi++) {
      const nextPi = (pi + 1) % nPts;
      if (bladeIdx === 0) {
        indices.push(hubCenterIdx, pi, nextPi);
      } else {
        indices.push(hubCenterIdx, nextPi, pi);
      }
    }

    // Cap tip end (si = SPAN_STATIONS)
    const tipCenterIdx = vertices.length / 3;
    const tipRing = rings[SPAN_STATIONS];
    vertices.push(tipRing[0].x, 0, 0);
    const tipOffset = SPAN_STATIONS * nPts;
    for (let pi = 0; pi < nPts; pi++) {
      const nextPi = (pi + 1) % nPts;
      if (bladeIdx === 0) {
        indices.push(tipCenterIdx, tipOffset + nextPi, tipOffset + pi);
      } else {
        indices.push(tipCenterIdx, tipOffset + pi, tipOffset + nextPi);
      }
    }

    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    bladeGeo.setIndex(indices);

    allGeometries.push(bladeGeo);
  }

  // Add central hub (vertical cylinder along Y axis)
  const hubRadius = 8.5 * scale;
  const hubLength = 14 * scale;
  const hubGeo = createHubGeometry(hubRadius, hubLength);
  allGeometries.push(hubGeo);

  // Merge all geometries
  const merged = mergeBufferGeometries(allGeometries);
  merged.computeVertexNormals();
  return merged;
}

// ─── Simple geometry merge (avoids importing BufferGeometryUtils) ──
function mergeBufferGeometries(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0;
  let totalIndices = 0;

  // Count totals
  for (const geo of geometries) {
    const pos = geo.getAttribute("position");
    totalVerts += pos.count;
    const idx = geo.getIndex();
    totalIndices += idx ? idx.count : 0;
  }

  const positions = new Float32Array(totalVerts * 3);
  const indexArr: number[] = [];
  let vertOffset = 0;

  for (const geo of geometries) {
    const pos = geo.getAttribute("position") as THREE.BufferAttribute;
    for (let i = 0; i < pos.count * 3; i++) {
      positions[vertOffset * 3 + i] = pos.array[i];
    }

    const idx = geo.getIndex();
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indexArr.push(idx.array[i] + vertOffset);
      }
    }

    vertOffset += pos.count;
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setIndex(indexArr);

  return merged;
}

/**
 * Creates the rear (tail) propeller geometry — same shape, smaller scale.
 */
export function createRearPropellerGeometry(scale: number = 1): THREE.BufferGeometry {
  return createPropellerGeometry(scale);
}

/**
 * Creates a circular disc geometry for high-speed rotor motion blur.
 * Outer radius matches the 127-unit blade span.
 */
export function createRotorBlurDiscGeometry(scale: number = 1): THREE.BufferGeometry {
  const outerRadius = 127 * scale;
  const innerRadius = 8.5 * scale;
  return new THREE.RingGeometry(innerRadius, outerRadius, 32, 4);
}
